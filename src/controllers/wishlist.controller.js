const Wishlist = require("../models/Wishlist.model");
const Variant = require("../models/Variant.model");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");

const addToWishlist = asyncHandler(async (req, res) => {
  const { variantId, size } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to add to wishlist");
  }

  if (!variantId || !size) {
    throw new APIError(400, "Variant ID and size are required");
  }

  const validSizes = ["M", "L", "XL", "XXL"];
  if (!validSizes.includes(size)) {
    throw new APIError(
      400,
      `Invalid size: ${size}. Must be one of ${validSizes.join(", ")}`
    );
  }

  const variant = await Variant.findById(variantId)
    .populate("product")
    .populate("color");
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  if (!variant.quantity.has(size)) {
    throw new APIError(400, `Size ${size} is not available for this variant`);
  }

  try {
    const wishlistItem = await Wishlist.create({
      variant: variantId,
      size,
      user: userId,
    });

    const populatedWishlistItem = await Wishlist.findById(wishlistItem._id)
      .populate({
        path: "variant",
        populate: [
          { path: "product", select: "name description" },
          { path: "color", select: "name hex" },
        ],
      })
      .lean();

    res
      .status(201)
      .json(
        new APIResponse(
          201,
          populatedWishlistItem,
          "Item added to wishlist successfully"
        )
      );
  } catch (error) {
    if (error.code === 11000) {
      throw new APIError(
        400,
        "This variant and size are already in your wishlist"
      );
    }
    throw error;
  }
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to remove from wishlist");
  }

  const wishlistItem = await Wishlist.findById(id);
  if (!wishlistItem) {
    throw new APIError(404, "Wishlist item not found");
  }

  if (wishlistItem.user.toString() !== userId.toString()) {
    throw new APIError(403, "You can only remove your own wishlist items");
  }

  await wishlistItem.deleteOne();
  res.json(
    new APIResponse(200, null, "Item removed from wishlist successfully")
  );
});

const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to view wishlist");
  }

  const wishlistItems = await Wishlist.find({ user: userId })
    .populate({
      path: "variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  res.json(
    new APIResponse(200, wishlistItems, "Wishlist retrieved successfully")
  );
});

const clearWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to clear wishlist");
  }

  await Wishlist.deleteMany({ user: userId });
  res.json(new APIResponse(200, [], "Wishlist cleared successfully"));
});

module.exports = {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    clearWishlist,
};
