const router = require('express').Router();
const verifyJWT = require("../middlewares/auth.middleware");
const restrictToAdmin = require('../middlewares/restrictToAdmin')
const {createColor,deleteColor,updateColor,getColorById,getColors} = require('../controllers/color.controller')

router.get('/:id', getColorById)
router.get('/', getColors)

router.use(verifyJWT);
router.use(restrictToAdmin);

router.post('/', createColor)
router.patch('/:id', updateColor)
router.delete('/:id', deleteColor)

module.exports = router