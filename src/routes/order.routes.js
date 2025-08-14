const express = require("express");
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/order.controller");
const verifyJWT = require('../middlewares/auth.middleware')

router.use(verifyJWT)
router.post("/",createOrder);
router.post("/verify",verifyPayment);
router.get("/user",getUserOrders);

// Admin Routes
router.get("/", getAllOrders);
router.put("/:id/status", updateOrderStatus);

module.exports = router;