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
router.use(verifyJWT)
router.post("/", upload.single("image"), createVariant);
router.patch("/:id", upload.single("image"), updateVariant);
router.delete("/:id", deleteVariant);
router.get("/", getVariants);
router.get("/:id", getVariantById);

module.exports = router;