const router = require('express').Router();
const verifyJWT = require("../middlewares/auth.middleware");
const {createColor,deleteColor,updateColor,getColorById,getColors} = require('../controllers/color.controller')

router.use(verifyJWT);
router.post('/', createColor)
router.patch('/:id', updateColor)
router.delete('/:id', deleteColor)
router.get('/:id', getColorById)
router.get('/', getColors)

module.exports = router