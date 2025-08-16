const router = require("express").Router();
const verifyJWT = require("../middlewares/auth.middleware");
const restrictToAdmin = require("../middlewares/restrictToAdmin");
const {
  dashboardStats,
  mostActiveUsers,
  mostPurchasedProducts,
  recentOrders,
} = require("../controllers/dashboard.controller");

router.use(verifyJWT)
router.post('/stats', dashboardStats)
router.get('/users', mostActiveUsers)
router.get('/products', mostPurchasedProducts)
router.post('/orders', recentOrders)

module.exports = router;
