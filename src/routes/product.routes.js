const {
createProduct,
deleteProduct,
updateProduct,
getProductIds,
getProductById,
getProducts
} = require("../controllers/product.controller");
const verifyJWT = require("../middlewares/auth.middleware");
const restrictToAdmin = require('../middlewares/restrictToAdmin')
const router = require("express").Router();
router.get('/',getProducts)
router.get('/:id',getProductById)
router.use(verifyJWT)
router.use(restrictToAdmin);
router.post('/', createProduct)
router.patch('/:id', updateProduct)
router.delete('/:id', deleteProduct)
router.get('/ids',getProductIds)

module.exports = router;