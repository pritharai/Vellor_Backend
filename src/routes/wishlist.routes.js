const router = require('express').Router()
const verifyJWT = require('../middlewares/auth.middleware')
const {addToWishlist,clearWishlist,getWishlist,removeFromWishlist} = require('../controllers/wishlist.controller')

router.post("/", verifyJWT, addToWishlist);
router.delete("/:id", verifyJWT, removeFromWishlist);
router.get("/", verifyJWT, getWishlist);
router.delete("/", verifyJWT, clearWishlist);

module.exports = router;
