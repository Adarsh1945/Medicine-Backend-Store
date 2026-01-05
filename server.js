const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- INVENTORY DATABASE ---
let inventory = [
  { id: 1, name: "Dolo 650", price: 25, stock: 10, slot: 1, purpose_en: "Fever & Body Pain", purpose_kn: "ಜ್ವರ ಮತ್ತು ಮೈ ಕೈ ನೋವು" },
  { id: 2, name: "Paracetamol", price: 25, stock: 10, slot: 2, purpose_en: "Headache & Mild Fever", purpose_kn: "ತಲೆನೋವು ಮತ್ತು ಸಾಮಾನ್ಯ ಜ್ವರ" },
  { id: 3, name: "Cheston Cold", price: 20, stock: 10, slot: 3, purpose_en: "Cold & Runny Nose", purpose_kn: "ನೆಗಡಿ ಮತ್ತು ಮೂಗು ಸೋರುವಿಕೆ" },
  { id: 4, name: "Digene", price: 20, stock: 10, slot: 4, purpose_en: "Acidity & Gas Relief", purpose_kn: "ಎದೆಯುರಿ ಮತ್ತು ಗ್ಯಾಸ್ಟ್ರಿಕ್ ಸಮಸ್ಯೆ" }
];

const rzp = new Razorpay({
  key_id: 'rzp_test_RRnoqnjGIdpuvd', 
  key_secret: 'hWqKxuJK1Ym9342ZkOmHHq8G' 
});

app.get('/inventory', (req, res) => res.json(inventory));

app.post('/refill', (req, res) => {
  const { slot, quantity } = req.body;
  const item = inventory.find(i => i.slot === slot);
  if (item) {
    item.stock += parseInt(quantity);
    return res.json({ success: true, newStock: item.stock });
  }
  res.status(404).send("Slot not found");
});

app.post('/create-order', async (req, res) => {
  const { productId, amount } = req.body;
  const item = inventory.find(i => i.id === productId);
  if (!item || item.stock <= 0) return res.status(400).send("Out of stock");

  try {
    const order = await rzp.orders.create({
      amount: amount, 
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });
    res.json(order);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, productId } = req.body;
  const secret = 'hWqKxuJK1Ym9342ZkOmHHq8G';

  const generated_signature = crypto.createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id).digest('hex');

  if (generated_signature === razorpay_signature) {
    const item = inventory.find(i => i.id === parseInt(productId));
    if (item && item.stock > 0) {
      item.stock -= 1;
      return res.json({ success: true, slot: item.slot });
    }
  }
  res.status(400).send("Verification failed");
});

// FIXED FOR RENDER: Listen on process.env.PORT and 0.0.0.0
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is live and listening on port ${PORT}`);
});