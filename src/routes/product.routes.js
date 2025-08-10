const {
createProduct,
deleteProduct,
updateProduct,
getProductIds,
getProductById,
getProducts
} = require("../controllers/product.controller");
const verifyJWT = require("../middlewares/auth.middleware");
const router = require("express").Router();
router.use(verifyJWT)
router.post('/', createProduct)
router.patch('/:id', updateProduct)
router.delete('/:id', deleteProduct)
router.get('/ids',getProductIds)
router.get('/',getProducts)
router.get('/:id',getProductById)

module.exports = router;
