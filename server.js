// server.js
// npm i express cors razorpay crypto axios dotenv

require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_RRnoqnjGIdpuvd';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'hWqKxuJK1Ym9342ZkOmHHq8G';
const MICRO_IP = process.env.MICRO_IP || '10.42.53.68';
const MICRO_ENDPOINT = `http://${MICRO_IP}/dispense`;

const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET
});

/* ===============================
   MEDICINE STOCK (IN-MEMORY)
================================ */
let medicines = {
  1: {
    id: 1,
    name_en: "Dolo 65",
    name_kn: "ಡೋಲೋ 65",
    purpose: "Used to reduce fever and body pain,ಜ್ವರ ಮತ್ತು ತಲೆನೋವು ಕಡಿಮೆ ಮಾಡಲು ಬಳಸಲಾಗುತ್ತದೆ",
    stock: 5,
    price: 25,
    slot: 1
  },
  2: {
    id: 2,
    name_en: "Paracetamol",
    name_kn: "ಪ್ಯಾರಾಸಿಟಮಾಲ್",
    purpose: "Pain relief and fever control,ನೋವು ಕಡಿಮೆ ಮಾಡುವುದು ಮತ್ತು ಜ್ವರ ಇಳಿಸುವುದು",
    stock: 5,
    price: 25,
    slot: 2
  },
  3: {
    id: 3,
    name_en: "Cheston Cold",
    name_kn: "ಚೆಸ್ಟನ್ ಕೋಲ್ಡ್",
    purpose: "Cold, cough and nasal congestion,ಜ್ವರ ಮತ್ತು ಕೆಮ್ಮಿನ ಪರಿಹಾರ",
    stock: 5,
    price: 20,
    slot: 3
  },
  4: {
    id: 4,
    name_en: "Digene",
    name_kn: "ಡೈಜಿನ್",
    purpose: "Relief from acidity and gasಅಮ್ಲ ಪುನರಾವೃತ್ತಿ ಮತ್ತು ಜೀರ್ಣಕ್ರಿಯೆಯ ಅಸಮಾಧಾನ",
    stock: 5,
    price: 20,
    slot: 4
  }
};

/* ===============================
   HEALTH CHECK
================================ */
app.get('/', (req, res) => {
  res.send('Medicine Vending Backend Running');
});

/* ===============================
   GET ALL MEDICINES (STOCK API)
================================ */
app.get('/medicines', (req, res) => {
  res.json(Object.values(medicines));
});

/* ===============================
   CREATE ORDER
================================ */
app.post('/create-order', async (req, res) => {
  try {
    const { productId } = req.body;
    const med = medicines[productId];

    if (!med) return res.status(404).send('Medicine not found');
    if (med.stock <= 0) return res.status(400).send('Out of stock');

    const order = await razorpay.orders.create({
      amount: med.price * 100,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { productId }
    });

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RZP_KEY_ID
    });
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

/* ===============================
   VERIFY PAYMENT
================================ */
app.post('/verify-payment', async (req, res) => {
  try {
    const { payment_id, order_id, signature, productId } = req.body;

    const hmac = crypto.createHmac('sha256', RZP_KEY_SECRET);
    hmac.update(order_id + "|" + payment_id);
    const generated = hmac.digest('hex');

    if (generated !== signature) {
      return res.status(400).send('Invalid signature');
    }

    const med = medicines[productId];
    if (!med || med.stock <= 0) {
      return res.status(400).send('Medicine unavailable');
    }

    // Decrease stock
    med.stock -= 1;

    // Try calling NodeMCU
    try {
      await axios.get(`${MICRO_ENDPOINT}?slot=${med.slot}`, { timeout: 3000 });
    } catch {
      console.log('MCU not reachable from server');
    }

    res.json({ success: true, slot: med.slot });
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

/* ===============================
   ADMIN REFILL API
================================ */
app.post('/admin/refill', (req, res) => {
  const { productId, quantity } = req.body;

  if (!medicines[productId]) {
    return res.status(404).send('Medicine not found');
  }

  medicines[productId].stock += Number(quantity);
  res.json({ success: true, medicine: medicines[productId] });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
