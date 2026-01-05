// server.js
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

const RZP_KEY_ID = rzp_test_RRnoqnjGIdpuvd;
const RZP_KEY_SECRET = hWqKxuJK1Ym9342ZkOmHHq8G;

const MICRO_IP = process.env.MICRO_IP || "10.42.53.68 ";
const MICRO_ENDPOINT = `http://${MICRO_IP}/dispense`;

const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET
});

/* =======================
   MEDICINE + STOCK
======================= */
let medicines = {
  1: {
    id: 1,
    name_en: "Dolo 65",
    name_kn: "ಡೋಲೋ 65",
    purpose: "Fever and body pain relief",
    price: 25,
    stock: 5,
    slot: 1
  },
  2: {
    id: 2,
    name_en: "Paracetamol",
    name_kn: "ಪ್ಯಾರಾಸಿಟಮಾಲ್",
    purpose: "Pain and fever",
    price: 25,
    stock: 3,
    slot: 2
  },
  3: {
    id: 3,
    name_en: "Digene",
    name_kn: "ಡೈಜಿನ್",
    purpose: "Acidity and gas",
    price: 20,
    stock: 2,
    slot: 3
  }
};

/* =======================
   GET MEDICINES
======================= */
app.get('/medicines', (req, res) => {
  res.json(Object.values(medicines));
});

/* =======================
   CREATE ORDER
======================= */
app.post('/create-order', async (req, res) => {
  const { productId } = req.body;
  const med = medicines[productId];

  if (!med) return res.status(404).send("Medicine not found");
  if (med.stock <= 0) return res.status(400).send("Out of stock");

  const order = await razorpay.orders.create({
    amount: med.price * 100,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: { productId }
  });

  res.json({
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: RZP_KEY_ID
  });
});

/* =======================
   VERIFY + DISPENSE
======================= */
app.post('/verify-payment', async (req, res) => {
  const { payment_id, order_id, signature, productId } = req.body;

  // 1️⃣ Verify Razorpay signature
  const hmac = crypto.createHmac("sha256", RZP_KEY_SECRET);
  hmac.update(order_id + "|" + payment_id);
  const generated = hmac.digest("hex");

  if (generated !== signature) {
    return res.status(400).send("Invalid payment");
  }

  const med = medicines[productId];
  if (!med || med.stock <= 0) {
    return res.status(400).send("Medicine unavailable");
  }

  // 2️⃣ Call NodeMCU to DISPENSE
  try {
    const mcuResp = await axios.get(
      `${MICRO_ENDPOINT}?slot=${med.slot}`,
      { timeout: 5000 }
    );

    if (mcuResp.data !== "DISPENSED") {
      throw new Error("MCU failed");
    }

    // 3️⃣ Update stock ONLY AFTER SUCCESS
    med.stock -= 1;

    res.json({ success: true });

  } catch (err) {
    console.error("Dispense failed:", err.message);
    res.status(500).send("Dispense failed. Payment safe.");
  }
});

/* =======================
   ADMIN REFILL
======================= */
app.post('/admin/refill', (req, res) => {
  const { productId, quantity } = req.body;

  if (!medicines[productId]) {
    return res.status(404).send("Medicine not found");
  }

  medicines[productId].stock += Number(quantity);
  res.json({ success: true, medicine: medicines[productId] });
});

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
