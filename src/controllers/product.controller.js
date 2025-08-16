const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Variant = require("../models/Variant.model");
const Review = require("../models/Review.model");
const Color = require("../models/Color.model");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");
const { removeFromCloudinary } = require("../utils/services/cloudinary.config");
const asyncHandler = require("../utils/API/asyncHandler");

const createProduct = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description)
    throw new APIError(400, "Name and Description are required");
  const existingProduct = await Product.findOne({ name: name.trim() });
  if (existingProduct)
    throw new APIError(400, "Product with this name already exists");
  const product = await Product.create({ name, description });
  res
    .status(201)
    .json(new APIResponse(201, product, "Product created successfully"));
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const product = await Product.findById(id);
  if (!product) throw new APIError(404, "Product not found");
  if (name) product.name = name;
  if (description) product.description = description;
  await product.save();
  res
    .status(200)
    .json(new APIResponse(200, product, "Product updated successfully"));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) throw new APIError(404, "Product not found");

  const variants = await Variant.find({ product: id });
  for (const variant of variants) {
    if (variant.image.public_id) {
      await removeFromCloudinary(variant.image.public_id);
    }
    await variant.deleteOne();
  }
  await product.deleteOne();
  res
    .status(200)
    .json(new APIResponse(200, null, "Product deleted successfully"));
});

const getProductIds = asyncHandler(async (req, res) => {
  const products = await Product.find();
  res
    .status(200)
    .json(
      new APIResponse(200, products, "All Products data fetched successfully")
    );
});

const getProducts = asyncHandler(async (req, res) => {
  const { search, color, minPrice, maxPrice, limit = 10, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const productQuery = {};
  if (search) {
    productQuery.$text = { $search: search };
  }

  const products = await Product.find(productQuery)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
  if (products.length === 0) {
    return res.json(new APIResponse(200, [], "No products found"));
  }
  const totalProducts = await Product.countDocuments(productQuery);
  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  const productIds = products.map((p) => p._id);
  const variantQuery = { product: { $in: productIds } };
  if (color || minPrice || maxPrice || search) {
    if (color)
      variantQuery.color = {
        $in: await Color.find({
          name: { $regex: color, $options: "i" },
        }).distinct("_id"),
      };
    if (minPrice) variantQuery.price = { $gte: parseFloat(minPrice) };
    if (maxPrice) {
      variantQuery.price = variantQuery.price || {};
      variantQuery.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      const colorIds = await Color.find({
        $text: { $search: search },
      }).distinct("_id");
      if (colorIds.length > 0) {
        variantQuery.color = variantQuery.color
          ? { $in: [...variantQuery.color.$in, ...colorIds] }
          : { $in: colorIds };
      }
    }
  }

  const variants = await Variant.find(variantQuery).populate("color").lean();
  const reviews = await Review.aggregate([
    { $match: { product: { $in: productIds } } },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const productsWithVariants = products.map((product) => {
    const productReviews = reviews.find(
      (r) => r._id.toString() === product._id.toString()
    );
    return {
      ...product,
      variants: variants.filter(
        (v) => v.product.toString() === product._id.toString()
      ),
      averageRating: productReviews
        ? Number(productReviews.averageRating.toFixed(1))
        : 0,
      reviewCount: productReviews ? productReviews.reviewCount : 0,
    };
  });

  res.json(
    new APIResponse(
      200,
      { products: productsWithVariants ,
        totalProducts,
        currentPage: parseInt(page),
        totalPages
      },
      "Products retrieved successfully"
    )
  );
});

const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id).lean();
  if (!product) {
    throw new APIError(404, "Product not found");
  }

  const variants = await Variant.find({ product: id }).populate("color").lean();
  const reviews = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(id) } },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const formattedProduct = {
    id: product._id,
    name: product.name,
    description: product.description,
    price: variants[0]?.price || 0,
    sizes: [...new Set(variants.flatMap((v) => Object.keys(v.quantity)))],
    colors: variants.map((v) => ({
      name: v.color.name,
      hex: v.color.hex,
      imageUrl: v.image.url,
    })),
    variants: variants.map((v) => ({
      _id: v._id,
      color: v.color.name,
      hex: v.color.hex,
      quantity: v.quantity,
      price: v.price,
      sku: v.sku,
      image: v.image,
    })),
    averageRating: reviews[0] ? Number(reviews[0].averageRating.toFixed(1)) : 0,
    reviewCount: reviews[0] ? reviews[0].reviewCount : 0,
  };

  res.json(
    new APIResponse(200, formattedProduct, "Product retrieved successfully")
  );
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getProductIds,
  getProducts,
};
