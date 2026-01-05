const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const medicines = require("./medicines");
const razorpay = require("./razorpay");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= MEDICINES API ================= */
app.get("/medicines", (req, res) => {
  res.json(Object.values(medicines));
});

/* ================= CREATE ORDER ================= */
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create(req.body);
    res.json({
      ...order,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ================= VERIFY PAYMENT ================= */
app.post("/verify-payment", (req, res) => {
  const { payment_id, order_id, signature, productId } = req.body;

  const body = order_id + "|" + payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== signature) {
    return res.status(400).json({ error: "Invalid payment" });
  }

  if (medicines[productId].stock <= 0) {
    return res.status(400).json({ error: "Out of stock" });
  }

  medicines[productId].stock -= 1;

  res.json({
    success: true,
    slot: medicines[productId].slot
  });
});

/* ================= ADMIN REFILL ================= */
app.post("/admin/refill", (req, res) => {
  const { productId, quantity } = req.body;
  medicines[productId].stock += quantity;
  res.json({ stock: medicines[productId].stock });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});