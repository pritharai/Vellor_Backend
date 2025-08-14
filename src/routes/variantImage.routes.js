const router = require("express").Router();
const verifyJWT = require("../middlewares/auth.middleware");
const upload = require("../middlewares/multer.middleware");
const {
  createVariantImages,
  deleteVariantImages,
  getVariantImages,
  getVariantImagesById,
  updateVariantImages,
} = require("../controllers/variantImage.controller");
const restrictToAdmin = require('../middlewares/restrictToAdmin')
router.get("/", getVariantImages);
router.get("/:id", getVariantImagesById);
router.use(verifyJWT)
// All Admin middlewares
router.use(restrictToAdmin);
router.post("/",upload.array('images',10), createVariantImages);
router.put("/:id", upload.array('images',10), updateVariantImages);
router.delete("/:id", deleteVariantImages);

module.exports = router