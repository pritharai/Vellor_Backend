const Color = require("../models/Color.model");
const Variant = require("../models/Variant.model");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");
const asyncHandler = require("../utils/API/asyncHandler");

const createColor = asyncHandler(async (req, res) => {
  const { name, hex } = req.body;
  if (!name || !hex) throw new APIError(400, "Name and hex code are requried");

  const existingColor = await Color.findOne({ name });
  if (existingColor) throw new APIError(400, "Color name already exists");

  const color = await Color.create({ name, hex });
  res
    .status(201)
    .json(new APIResponse(201, color, "Color created successfully"));
});

const updateColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, hex } = req.body;
  const color = await Color.findById(id);
  if (!color) throw new APIError(404, "Color not found");

  // Checking if color name is given for updation and is it the same name as of previous or not
  if (name && name.trim() !== color.name) {
    // if name is given, Checking the uniqueness of the new color
    const existingColor = await Color.find({ name: name.trim() });
    if (existingColor)
      throw new APIError(400, "Color with this name already exists");
    color.name = name.trim();
  }

  // if hex code is given
  if (hex) color.hex = hex.trim();
  await color.save();
  res
    .status(200)
    .json(new APIResponse(200, color, "Color updated successfully"));
});

const deleteColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const color = await Color.findById(id);
  if (!color) throw new APIError(404, "Color not found");
  const variantCount = await Variant.countDocuments({ color: id });
  if (variantCount > 0) {
    throw new APIError(
      400,
      "Cannot delete color. Variants are associated with it."
    );
  }

  await Color.findByIdAndDelete(id);

  res
    .status(200)
    .json(new APIResponse(200, null, "Color deleted successfully"));
});

const getColorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const color = await Color.findById(id);
  if (!color) throw new APIError(404, "Color not found");
  res.status(200).json(new APIResponse(200,color, "Color found succefully"));
});

const getColors = asyncHandler(async (req, res) => {
  const colors = await Color.find().sort({name:1});
  res.status(200).json(new APIResponse(200,colors, "Colors fetched sucessfully"));
});

module.exports = {
  createColor,
  updateColor,
  deleteColor,
  getColorById,
  getColors,
};
