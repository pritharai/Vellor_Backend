const Order = require("../models/Order.model");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");
const User = require('../models/User.model')
const Product = require('../models/Product.model')

const mostActiveUsers = asyncHandler(async (req, res) => {
  const { limit = 10, sortBy = "orderCount" } = req.query;

  if (!["orderCount", "totalSpent"].includes(sortBy)) {
    throw new APIError(400, "sortBy must be 'orderCount' or 'totalSpent'");
  }

  const pipeline = [
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        email: "$user.email",
        orderCount: 1,
        totalSpent: 1,
      },
    },
    { $sort: { [sortBy]: -1 } },
    { $limit: parseInt(limit) },
  ];

  const activeUsers = await Order.aggregate(pipeline);

  res.json(
    new APIResponse(
      200,
      activeUsers,
      "Most active users retrieved successfully"
    )
  );
});

const mostPurchasedProducts = asyncHandler(async (req, res) => {
  const { limit = 10, sortBy = "quantitySold" } = req.query;

  if (!["quantitySold", "orderCount"].includes(sortBy)) {
    throw new APIError(400, "sortBy must be 'quantitySold' or 'orderCount'");
  }

  const pipeline = [
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.variant",
        productId: { $first: "$items.variant.product" },
        quantitySold: { $sum: "$items.quantity" },
        orderCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "_id",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    {
      $lookup: {
        from: "products",
        localField: "variant.product",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "colors",
        localField: "variant.color",
        foreignField: "_id",
        as: "color",
      },
    },
    { $unwind: "$color" },
    {
      $project: {
        _id: 0,
        variantId: "$_id",
        productId: "$product._id",
        productName: "$product.name",
        colorName: "$color.name",
        colorHex: "$color.hex",
        image: "$variant.image",
        quantitySold: 1,
        orderCount: 1,
      },
    },
    { $sort: { [sortBy]: -1 } },
    { $limit: parseInt(limit) },
  ];

  const purchasedProducts = await Order.aggregate(pipeline);

  res.json(
    new APIResponse(
      200,
      purchasedProducts,
      "Most purchased products retrieved successfully"
    )
  );
});

const recentOrders = asyncHandler(async (req, res) => {
  const { status, method } = req.body;
  const { limit = 10, page = 1 } = req.query;
  const validStatuses = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const validMethods = ["cod", "online"];

  if (status && !validStatuses.includes(status)) {
    throw new APIError(400, "Invalid status filter");
  }
  if (method && !validMethods.includes(method)) {
    throw new APIError(400, "Invalid method filter");
  }

  const query = {};
  if (status) query.status = status;
  if (method) query.paymentMethod = method;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const orders = await Order.find(query)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const totalOrders = await Order.countDocuments(query);

  res.json(
    new APIResponse(
      200,
      {
        orders,
        totalOrders,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / parseInt(limit)),
      },
      "Recent orders retrieved successfully"
    )
  );
});

const dashboardStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;


  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new APIError(
        400,
        "Both startDate and endDate are required for date filtering"
      );
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new APIError(400, "Invalid date range");
    }
  }


  const dateFilter =
    startDate && endDate
      ? {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        }
      : {};


  const totalOrders = await Order.countDocuments(dateFilter);
  const totalCustomers = await User.countDocuments({ role: "customer" });
  const totalProducts = await Product.countDocuments();
  const revenueResult = await Order.aggregate([
    { $match: { ...dateFilter, paymentStatus: "completed" } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);
  const totalRevenue =
    revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const ordersByStatus = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        status: "$_id",
        count: 1,
      },
    },
  ]);

  
  const ordersByMethod = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        method: "$_id",
        count: 1,
      },
    },
  ]);

  const stats = {
    totalOrders,
    totalCustomers,
    totalProducts,
    totalRevenue,
    ordersByStatus: ordersByStatus.reduce(
      (acc, { status, count }) => {
        acc[status] = count;
        return acc;
      },
      { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }
    ),
    ordersByMethod: ordersByMethod.reduce(
      (acc, { method, count }) => {
        acc[method] = count;
        return acc;
      },
      { cod: 0, online: 0 }
    ),
  };

  res.json(
    new APIResponse(200, stats, "Dashboard stats retrieved successfully")
  );
});

module.exports = {
  mostActiveUsers,
  mostPurchasedProducts,
  recentOrders,
  dashboardStats,
};
