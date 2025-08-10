const router  = require("express").Router();
const verifyJWT = require("../middlewares/auth.middleware");
const {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
} = require("../controllers/cart.controller");

router.post("/", verifyJWT, addToCart);
router.patch("/item", verifyJWT, updateCartItem);
router.delete("/item/:itemId", verifyJWT, removeFromCart);
router.get("/", verifyJWT, getCart);
router.delete("/", verifyJWT, clearCart);

module.exports = router;