// server.js (recommended endpoints)
// npm i express cors body-parser razorpay crypto axios
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
const MICRO_IP = process.env.MICRO_IP || '10.245.115.68';
// Root endpoint for health check or basic info
app.get('/', (req, res) => {
  res.send('Medicine Backend Store API is running');
});
const MICRO_ENDPOINT = `http://10.245.115.68/dispense`; // backend won't call MCU if not reachable

const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET
});

// create order endpoint
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

// verify endpoint
app.post('/verify-payment', async (req, res) => {
  try {
    const { payment_id, order_id, signature, productId } = req.body;
    if (!payment_id || !order_id || !signature) return res.status(400).send('Missing params');

    // verify signature
    const generated_signature = crypto.createHmac('sha256', RZP_KEY_SECRET)
      .update(order_id + '|' + payment_id).digest('hex');

    if (generated_signature !== signature) {
      return res.status(400).send('Invalid signature');
    }

    // Payment verified. Decide slot (map productId -> slot index)
    const slot = parseInt(productId) || 1;

    // Optionally server can call MCU (only works if server is on same network)
    // We will attempt if MICRO_IP is reachable from server; otherwise frontend will call MCU.
    try {
      await axios.get(`${MICRO_ENDPOINT}?slot=${slot}`, { timeout: 3000 });
      console.log('MCU dispense called from server for slot', slot);
    } catch (mcErr) {
      console.warn('Server could not call MCU (likely network). Frontend should call MCU instead.');
    }

    // respond to frontend with success and slot info
    res.json({ success: true, slot });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
