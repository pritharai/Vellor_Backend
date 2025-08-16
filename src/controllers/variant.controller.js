const Variant = require("../models/Variant.model");
const Product = require("../models/Product.model");
const Color = require("../models/Color.model");
const asyncHandler = require("../utils/API/asyncHandler");
const {
  uploadOnCloudinary,
  removeFromCloudinary,
} = require("../utils/services/cloudinary.config");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");

const createVariant = asyncHandler(async (req, res) => {
  const { productId, colorId, quantity, price } = req.body;
  const file = req.file;

  if (!productId || !colorId || !quantity || !price || !file) {
    throw new APIError(
      400,
      "Product ID, color ID, quantity, price, and image are required"
    );
  }

  let parsedQuantity;
  try {
    parsedQuantity =
      typeof quantity === "string" ? JSON.parse(quantity) : quantity;
    if (
      typeof parsedQuantity !== "object" ||
      !Object.keys(parsedQuantity).length
    ) {
      throw new Error();
    }
  } catch (error) {
    throw new APIError(
      400,
      "Quantity must be a valid JSON object with size-stock pairs"
    );
  }

  const validSizes = ["M", "L", "XL", "XXL"];
  for (const [size, stock] of Object.entries(parsedQuantity)) {
    if (!validSizes.includes(size)) {
      throw new APIError(
        400,
        `Invalid size: ${size}. Must be one of ${validSizes.join(", ")}`
      );
    }
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
      throw new APIError(
        400,
        `Stock for size ${size} must be a non-negative integer`
      );
    }
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new APIError(404, "Product not found");
  }

  const color = await Color.findById(colorId);
  if (!color) {
    throw new APIError(404, "Color not found");
  }

  const existingVariant = await Variant.findOne({
    product: productId,
    color: colorId,
  });
  if (existingVariant) {
    throw new APIError(
      400,
      "Variant for this product and color already exists"
    );
  }

  sku = `${product.name}-${color.name}`.replace(/\s+/g, "-").toUpperCase();

  const cloudinaryResponse = await uploadOnCloudinary(file.path);
  if (!cloudinaryResponse) {
    throw new APIError(500, "Error uploading image to Cloudinary");
  }

  const variant = await Variant.create({
    product: productId,
    color: colorId,
    quantity: parsedQuantity,
    price: parseFloat(price),
    sku,
    image: {
      url: cloudinaryResponse.secure_url,
      public_id: cloudinaryResponse.public_id,
    },
  });

  res
    .status(201)
    .json(new APIResponse(201, variant, "Variant created successfully"));
});

const updateVariant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, price } = req.body;
  const file = req.file;

  const variant = await Variant.findById(id);
  if (!variant) throw new APIError(404, "Variant not found");

  if (quantity) {
    let parsedQuantity;
    try {
      parsedQuantity =
        typeof quantity === "string" ? JSON.parse(quantity) : quantity;
      if (typeof parsedQuantity !== "object") throw new Error();
    } catch (error) {
      throw new APIError(
        400,
        "Quantity must be a valid JSON object with size-stock pairs"
      );
    }
    const validSizes = ["M", "L", "XL", "XXL"];
    for (const [size, stock] of Object.entries(parsedQuantity)) {
      if (!validSizes.includes(size)) {
        throw new APIError(
          400,
          `Invalid size: ${size}. Must be one of ${validSizes.join(", ")}`
        );
      }
      if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        throw new APIError(
          400,
          `Stock for size ${size} must be a non-negative integer`
        );
      }
    }
    variant.quantity = parsedQuantity;
  }

  if (price) variant.price = parseFloat(price);

  if (file) {
    if (variant.image.public_id) {
      await removeFromCloudinary(variant.image.public_id);
    }
    const cloudinaryResponse = await uploadOnCloudinary(file.path);
    if (!cloudinaryResponse) {
      throw new APIError(500, "Error uploading image to Cloudinary");
    }
    variant.image = {
      url: cloudinaryResponse.secure_url,
      public_id: cloudinaryResponse.public_id,
    };
  }

  await variant.save();
  res.json(new APIResponse(200, variant, "Variant updated successfully"));
});

const deleteVariant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const variant = await Variant.findById(id);
  if (!variant) throw new APIError(404, "Variant not found");

  if (variant.image.public_id) {
    await removeFromCloudinary(variant.image.public_id);
  }

  await variant.deleteOne();
  res.json(new APIResponse(200, null, "Variant deleted successfully"));
});

const getVariants = asyncHandler(async (req, res) => {
  const { productId, size, color, minPrice, maxPrice, search, limit = 10, page = 1 } = req.query;

  // Validate inputs
  if (productId && !mongoose.isValidObjectId(productId)) {
    throw new APIError(400, "Invalid productId format");
  }
  if (minPrice && isNaN(parseFloat(minPrice))) {
    throw new APIError(400, "minPrice must be a valid number");
  }
  if (maxPrice && isNaN(parseFloat(maxPrice))) {
    throw new APIError(400, "maxPrice must be a valid number");
  }
  if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
    throw new APIError(400, "minPrice cannot be greater than maxPrice");
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = {};
  if (productId) {
    query.product = productId;
    const product = await Product.findById(productId);
    if (!product) throw new APIError(404, "Product not found");
  }
  if (color) {
    query.color = {
      $in: await Color.find({
        name: { $regex: color, $options: "i" },
      }).distinct("_id"),
    };
  }
  if (minPrice) query.price = { $gte: parseFloat(minPrice) };
  if (maxPrice) {
    query.price = query.price || {};
    query.price.$lte = parseFloat(maxPrice);
  }
  if (search) {
    const colorIds = await Color.find({ $text: { $search: search } }).distinct("_id");
    if (colorIds.length > 0) {
      query.color = query.color
        ? { $in: [...query.color.$in, ...colorIds] }
        : { $in: colorIds };
    }
  }
  if (size) {
    query[`quantity.${size}`] = { $gt: 0 };
  }

  const variants = await Variant.find(query)
    .populate("color", "hex name")
    .populate("product", "name description")
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const totalVariants = await Variant.countDocuments(query);
  const totalPages = Math.ceil(totalVariants / parseInt(limit));

  if (variants.length === 0) {
    return res.json(
      new APIResponse(
        200,
        {
          variants: [],
          totalVariants: 0,
          currentPage: parseInt(page),
          totalPages: 0,
        },
        "No variants found"
      )
    );
  }

  res.json(
    new APIResponse(
      200,
      {
        variants,
        totalVariants,
        currentPage: parseInt(page),
        totalPages,
      },
      "Variants retrieved successfully"
    )
  );
});

const getVariantById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const variant = await Variant.findById(id)
    .populate("color")
    .populate("product")
    .lean();
  if (!variant) {
    throw new APIError(404, "Variant not found");
  }

  const formattedVariant = {
    id: variant._id,
    product: {
      id: variant.product._id,
      name: variant.product.name,
      description: variant.product.description,
    },
    color: {
      name: variant.color.name,
      hex: variant.color.hex,
    },
    quantity: variant.quantity,
    price: variant.price,
    sku: variant.sku,
    image: variant.image,
  };

  res.json(
    new APIResponse(200, formattedVariant, "Variant retrieved successfully")
  );
});

module.exports = {
  createVariant,
  updateVariant,
  deleteVariant,
  getVariants,
  getVariantById,
};
