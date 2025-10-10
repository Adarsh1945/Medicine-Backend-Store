const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your Razorpay test keys
const razorpay = new Razorpay({
  key_id: "rzp_test_RRnoqnjGIdpuvd",
  key_secret: "hWqKxuJK1Ym9342ZkOmHHq8G"
});

// Test route
app.get("/", (req, res) => res.send("✅ Server is running!"));

// POST /create-order (Razorpay)
app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ message: "Amount is required" });
  }

  const options = {
    amount: amount * 100, // amount in paise
    currency: "INR",
    receipt: "receipt#1"
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(201).json(order);
  } catch (error) {
    console.error("Razorpay error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

const PORT = 2000;
app.listen(PORT, () => console.log('🚀 Server running at http://localhost:2000'));