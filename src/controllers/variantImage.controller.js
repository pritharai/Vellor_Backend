const Variant = require("../models/Variant.model");
const VariantImage = require("../models/VariantImage.model");
const asyncHandler = require("../utils/API/asyncHandler");
const { uploadOnCloudinary, removeFromCloudinary } = require("../utils/services/cloudinary.config");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");

const createVariantImages = asyncHandler(async (req, res) => {
  const { variantId } = req.body;
  const files = req.files;

  if (!variantId) {
    throw new APIError(400, "Variant ID is required");
  }

  const variant = await Variant.findById(variantId);
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  const existingImages = await VariantImage.findOne({ variant: variantId });
  if (existingImages) {
    throw new APIError(400, "Images for this variant already exist");
  }

  if (!files || files.length === 0) {
    throw new APIError(400, "At least one image is required");
  }

  const images = [];
  for (const file of files) {
    const cloudinaryResponse = await uploadOnCloudinary(file.path);
    if (!cloudinaryResponse) {
      for (const img of images) {
        await removeFromCloudinary(img.public_id);
      }
      throw new APIError(500, "Error uploading image to Cloudinary");
    }
    images.push({
      url: cloudinaryResponse.secure_url,
      public_id: cloudinaryResponse.public_id,
    });
  }

  const variantImage = await VariantImage.create({
    variant: variantId,
    images,
  });

  res.status(201).json(new APIResponse(201, variantImage, "Variant images created successfully"));
});

const updateVariantImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  const variantImage = await VariantImage.findById(id);
  if (!variantImage) {
    throw new APIError(404, "Variant images not found");
  }

  if (!files || files.length === 0) {
    throw new APIError(400, "At least one new image is required");
  }

  for (const img of variantImage.images) {
    await removeFromCloudinary(img.public_id);
  }

  const newImages = [];
  for (const file of files) {
    const cloudinaryResponse = await uploadOnCloudinary(file.path);
    if (!cloudinaryResponse) {
      for (const img of newImages) {
        await removeFromCloudinary(img.public_id);
      }
      throw new APIError(500, "Error uploading image to Cloudinary");
    }
    newImages.push({
      url: cloudinaryResponse.secure_url,
      public_id: cloudinaryResponse.public_id,
    });
  }

  variantImage.images = newImages;
  await variantImage.save();

  res.json(new APIResponse(200, variantImage, "Variant images updated successfully"));
});

const deleteVariantImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const variantImage = await VariantImage.findById(id);
  if (!variantImage) {
    throw new APIError(404, "Variant images not found");
  }

  for (const img of variantImage.images) {
    await removeFromCloudinary(img.public_id);
  }

  await variantImage.deleteOne();

  res.json(new APIResponse(200, null, "Variant images deleted successfully"));
});

const getVariantImages = asyncHandler(async (req, res) => {
  const { variantId } = req.query;

  if (!variantId) {
    throw new APIError(400, "Variant ID is required");
  }

  const variant = await Variant.findById(variantId);
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  const variantImages = await VariantImage.findOne({ variant: variantId }).lean();
  if (!variantImages) {
    return res.json(new APIResponse(200, { images: [] }, "No variant images found"));
  }

  res.json(new APIResponse(200, variantImages, "Variant images retrieved successfully"));
});

const getVariantImagesById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const variantImage = await VariantImage.findById(id).lean();
  if (!variantImage) {
    throw new APIError(404, "Variant images not found");
  }

  res.json(new APIResponse(200, variantImage, "Variant images retrieved successfully"));
});

module.exports = {
  createVariantImages,
  updateVariantImages,
  deleteVariantImages,
  getVariantImages,
  getVariantImagesById,
};