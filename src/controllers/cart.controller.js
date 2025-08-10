const Cart = require("../models/Cart.model");
const Variant = require("../models/Variant.model");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");

const addToCart = asyncHandler(async (req, res) => {
  const { variantId, size, quantity } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to add to cart");
  }

  if (!variantId || !size || !quantity) {
    throw new APIError(400, "Variant ID, size, and quantity are required");
  }

  const validSizes = ["M", "L", "XL", "XXL"];
  if (!validSizes.includes(size)) {
    throw new APIError(
      400,
      `Invalid size: ${size}. Must be one of ${validSizes.join(", ")}`
    );
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new APIError(400, "Quantity must be a positive integer");
  }

  const variant = await Variant.findById(variantId)
    .populate("product")
    .populate("color");
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  const stock = variant.quantity.get(size) || 0;
  if (stock < quantity) {
    throw new APIError(
      400,
      `Insufficient stock for size ${size}. Available: ${stock}`
    );
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.variant.toString() === variantId && item.size === size
  );

  if (existingItemIndex !== -1) {
    // Update existing item
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    if (stock < newQuantity) {
      throw new APIError(
        400,
        `Insufficient stock for size ${size}. Available: ${stock}`
      );
    }
    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    // Add new item
    cart.items.push({ variant: variantId, size, quantity });
  }

  await cart.save();
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  res
    .status(200)
    .json(
      new APIResponse(200, populatedCart, "Item added to cart successfully")
    );
});

const updateCartItem = asyncHandler(async (req, res) => {
  // itemId -> _id of subdoc of Cart (specific item in array of cart items)
  const { itemId, quantity } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to update cart");
  }

  if (!itemId || !quantity) {
    throw new APIError(400, "Item ID and quantity are required");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new APIError(400, "Quantity must be a positive integer");
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new APIError(404, "Cart not found");
  }

  const item = cart.items.id(itemId);
  if (!item) {
    throw new APIError(404, "Cart item not found");
  }

  const variant = await Variant.findById(item.variant);
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  const stock = variant.quantity.get(item.size) || 0;
  if (stock < quantity) {
    throw new APIError(
      400,
      `Insufficient stock for size ${item.size}. Available: ${stock}`
    );
  }

  item.quantity = quantity;
  await cart.save();

  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  res
    .status(200)
    .json(
      new APIResponse(200, populatedCart, "Cart item updated successfully")
    );
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to remove from cart");
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new APIError(404, "Cart not found");
  }

  const item = cart.items.id(itemId);
  if (!item) {
    throw new APIError(404, "Cart item not found");
  }

  cart.items.pull(itemId);
  await cart.save();

  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  res
    .status(200)
    .json(
      new APIResponse(200, populatedCart, "Item removed from cart successfully")
    );
});

const getCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to view cart");
  }

  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.variant',
    populate: [
      { path: 'product', select: 'name description' },
      { path: 'color', select: 'name hex' },
    ],
  }).lean();

  if (!cart) {
    return res.json(new APIResponse(200, { user: userId, items: [] }, "Cart is empty"));
  }

  res.json(new APIResponse(200, cart, "Cart retrieved successfully"));
});


const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to clear cart");
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.json(new APIResponse(200, { user: userId, items: [] }, "Cart is already empty"));
  }

  cart.items = [];
  await cart.save();

  res.json(new APIResponse(200, { user: userId, items: [] }, "Cart cleared successfully"));
});


module.exports = {
  addToCart,
  updateCartItem,
  removeFromCart,
    getCart,
    clearCart,
};
