const http = require("http");
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
// Reduce stock
medicines[productId].stock -= 1;

// ---- CALL ESP8266 FROM BACKEND ----
const espIp = "192.168.1.105"; // YOUR ESP IP
const slot = medicines[productId].slot;

http.get(`http://${espIp}/dispense?slot=${slot}`, (resp) => {
  console.log("ESP8266 dispense triggered");
}).on("error", (err) => {
  console.error("ESP8266 not reachable");
});

res.json({
  success: true,
  message: "Payment verified, dispensing triggered",
  slot
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