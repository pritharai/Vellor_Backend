const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multer.middleware");
const {
  createVariant,
  updateVariant,
  deleteVariant,
  getVariants,
  getVariantById,
} = require("../controllers/variant.controller");
const verifyJWT = require("../middlewares/auth.middleware");
const restrictToAdmin = require('../middlewares/restrictToAdmin')

router.get("/", getVariants);
router.get("/:id", getVariantById);
router.use(verifyJWT)
router.use(restrictToAdmin);
router.post("/", upload.single("image"), createVariant);
router.patch("/:id", upload.single("image"), updateVariant);
router.delete("/:id", deleteVariant);
module.exports = router;