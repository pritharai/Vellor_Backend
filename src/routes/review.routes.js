const router = require("express").Router();
const verifyJWT = require("../middlewares/auth.middleware");
const {
  createReview,
  deleteReview,
  getReviewsByProduct,
} = require("../controllers/review.controller");

router.post('/', verifyJWT,createReview)
router.delete('/:id', verifyJWT,deleteReview)
router.get('/product/:productId', getReviewsByProduct)

module.exports = router