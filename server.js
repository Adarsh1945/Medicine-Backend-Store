// server.js (Medicine Vending Machine Backend)
// npm i express cors body-parser razorpay crypto axios

const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ============================
// TEMPORARY IN-MEMORY STOCK
// ============================
let medicines = {
  1: { name_en: "Dolo 65", name_kn: "ಡೋಲೋ 65", stock: 10, slot: 1 },
  2: { name_en: "Paracetamol", name_kn: "ಪ್ಯಾರಾಸಿಟಮಾಲ್", stock: 10, slot: 2 },
  3: { name_en: "Cheston Cold", name_kn: "ಚೆಸ್ಟನ್ ಕೋಲ್ಡ್", stock: 10, slot: 3 },
  4: { name_en: "Digene", name_kn: "ಡೈಜಿನ್", stock: 10, slot: 4 }
};

// ============================
// CONFIG
// ============================
const PORT = process.env.PORT || 3000;
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_RRnoqnjGIdpuvd';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'hWqKxuJK1Ym9342ZkOmHHq8G';
const MICRO_IP = process.env.MICRO_IP || '10.42.53.68';
const MICRO_ENDPOINT = `http://${MICRO_IP}/dispense`;

// Razorpay instance
const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET
});

// ============================
// ROOT ENDPOINT
// ============================
app.get('/', (req, res) => {
  res.send('Medicine Backend Store API is running');
});

// ============================
// GET STOCK - for frontend display
// ============================
app.get('/stock', (req, res) => {
  res.json(medicines);
});

// ============================
// CREATE ORDER
// ============================
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    if (!amount) return res.status(400).send('Missing amount');

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    });

    // Return order id + key_id so frontend can open checkout
    res.json({ id: order.id, amount: order.amount, currency: order.currency, key_id: RZP_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

// ============================
// VERIFY PAYMENT WITH STOCK CHECK
// ============================
app.post('/verify-payment', async (req, res) => {
  try {
    const { payment_id, order_id, signature, productId } = req.body;
    if (!payment_id || !order_id || !signature || !productId) {
      return res.status(400).send('Missing params');
    }

    const medicine = medicines[productId];
    if (!medicine) {
      return res.status(400).send('Invalid product ID');
    }

    if (medicine.stock <= 0) {
      return res.status(400).send(`${medicine.name} is out of stock`);
    }

    // verify Razorpay signature
    const generated_signature = crypto.createHmac('sha256', RZP_KEY_SECRET)
      .update(order_id + '|' + payment_id).digest('hex');

    if (generated_signature !== signature) {
      return res.status(400).send('Invalid signature');
    }

    // Payment verified and stock available
    // Reduce stock
    medicine.stock -= 1;

    // Call MCU to dispense (optional)
    const slot = medicine.slot;
    try {
      await axios.get(`${MICRO_ENDPOINT}?slot=${slot}`, { timeout: 3000 });
      console.log('MCU dispense called from server for slot', slot);
    } catch (mcErr) {
      console.warn('Server could not call MCU (likely network). Frontend should call MCU instead.');
    }

    // respond with success, updated stock
    res.json({ success: true, slot, remainingStock: medicine.stock });

  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});