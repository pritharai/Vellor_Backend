const Order = require("../models/Order.model");
const Cart = require("../models/Cart.model");
const Variant = require("../models/Variant.model");
const User = require("../models/User.model");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const createOrder = asyncHandler(async (req, res) => {
  const { itemIds, addressId, paymentMethod, shippingAddress } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to create an order");
  }

  const validPaymentMethods = ["cod", "online"];
  const selectedPaymentMethod = paymentMethod || "online";
  if (!validPaymentMethods.includes(selectedPaymentMethod)) {
    throw new APIError(400, "Invalid Payment Method");
  }


  let orderShippingAddress;
  const user = await User.findById(userId).select("address");
  if (!user) {
    throw new APIError(404, "User not found");
  }

  if (addressId) {
    const address = user.address.id(addressId);
    if (!address) {
      throw new APIError(400, "Invalid Address ID");
    }
    orderShippingAddress = {
      
        houseNumber: address.houseNumber,
        street: address.street,
        colony: address.colony,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      };
  } else if (shippingAddress) {
    const { houseNumber, street, colony, city, state, country, postalCode } = shippingAddress;
    if (!houseNumber || !street || !colony || !city || !state || !country || !postalCode) {
      throw new APIError(400, "Complete shipping address is required");
    }
    orderShippingAddress = {
        houseNumber,
        street,
        colony,
        city,
        state,
        country,
        postalCode,
    };
  } else {
    const defaultAddress = user.address.find((addr) => addr.isDefault);
    if (!defaultAddress) {
      throw new APIError(400, "No default address set and no address provided");
    }
    orderShippingAddress = {
        houseNumber: defaultAddress.houseNumber,
        street: defaultAddress.street,
        colony: defaultAddress.colony,
        city: defaultAddress.city,
        state: defaultAddress.state,
        country: defaultAddress.country,
        postalCode: defaultAddress.postalCode,
    };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const cart = await Cart.findOne({ user: userId }).session(session);
    if (!cart) {
      throw new APIError(404, "Cart not found");
    }

    // Calculate expected delivery date
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + Number(process.env.EXPECTED_DELIVERY));

    // Function to prepare order items & calculate total
    const prepareOrderItems = async (items) => {
      let totalAmount = 0;
      let orderItems = [];

      for (const item of items) {
        const variant = await Variant.findById(item.variant).session(session);
        if (!variant) throw new APIError(404, "Variant not found");

        const stock = variant.quantity.get(item.size) || 0;
        if (stock < item.quantity) {
          throw new APIError(
            400,
            `Insufficient stock for size ${item.size} of variant ${variant._id}. Available: ${stock}`
          );
        }

        totalAmount += item.quantity * variant.price;
        orderItems.push({
          variant: item.variant,
          size: item.size,
          quantity: item.quantity,
          price: variant.price,
        });
      }

      return { totalAmount, orderItems };
    };

    // Decide if "Buy Now" or full cart
    let selectedItems = [];
    if (itemIds && itemIds.length > 0) {
      selectedItems = cart.items.filter((item) =>
        itemIds.includes(item._id.toString())
      );
      if (selectedItems.length !== itemIds.length) {
        throw new APIError(404, "Some cart items not found");
      }
    } else {
      if (cart.items.length === 0) throw new APIError(400, "Cart is empty");
      selectedItems = cart.items;
    }

    // Prepare data
    const { totalAmount, orderItems } = await prepareOrderItems(selectedItems);

    // Razorpay order only if online
    let razorpayOrder = null;
    if (selectedPaymentMethod === "online") {
      razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });
    }

    // Update stock for COD orders
    if (selectedPaymentMethod === "cod") {
      for (const item of orderItems) {
        const variant = await Variant.findById(item.variant).session(session);
        if (variant) {
          const currentStock = variant.quantity.get(item.size) || 0;
          variant.quantity.set(item.size, Math.max(0, currentStock - item.quantity));
          await variant.save({ session });
        }
      }
    }

    // Create the order
    const order = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          totalAmount,
          status: selectedPaymentMethod === "cod" ? "processing" : "pending",
          paymentStatus: selectedPaymentMethod === "cod" ? "completed" : "pending",
          razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
          shippingAddress: orderShippingAddress,
          expectedDelivery,
          paymentMethod
        },
      ],
      { session }
    );

    // Remove from cart
    if (itemIds && itemIds.length > 0) {
      cart.items = cart.items.filter(
        (item) => !itemIds.includes(item._id.toString())
      );
    } else {
      cart.items = [];
    }
    await cart.save({ session });

    await session.commitTransaction();

    // Populate order for response
    const populatedOrder = await Order.findById(order[0]._id).populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    }).lean();

    res.status(201).json(
      new APIResponse(
        201,
        { order: populatedOrder, razorpayOrder },
        "Order created successfully. Proceed to payment."
      )
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Verify payment (unchanged)
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayPaymentId, razorpaySignature } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to verify payment");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new APIError(404, "Order not found");
  }

  if (order.user.toString() !== userId.toString()) {
    throw new APIError(403, "You can only verify your own order");
  }

  const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order.razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new APIError(400, "Invalid payment signature");
  }

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.paymentStatus = "completed";
  order.status = "processing";

  // Reduce stock in variants
  for (const item of order.items) {
    const variant = await Variant.findById(item.variant);
    if (variant) {
      const currentStock = variant.quantity.get(item.size) || 0;
      variant.quantity.set(item.size, Math.max(0, currentStock - item.quantity));
      await variant.save();
    }
  }

  await order.save();


  const populatedOrder = await Order.findById(order._id).populate({
    path: "items.variant",
    populate: [
      { path: "product", select: "name description" },
      { path: "color", select: "name hex" },
    ],
  }).lean();

  if (populatedOrder.shippingAddress.type === "addressId") {
    const user = await User.findById(userId).select("address");
    populatedOrder.shippingAddress.addressDetails = user.address.id(populatedOrder.shippingAddress.addressId);
  }

  res.json(new APIResponse(200, populatedOrder, "Payment verified and order processed successfully"));
});


const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to view orders");
  }

  const orders = await Order.find({ user: userId }).populate({
    path: "items.variant",
    populate: [
      { path: "product", select: "name description" },
      { path: "color", select: "name hex" },
    ],
  }).sort({ createdAt: -1 }).lean();


  const user = await User.findById(userId).select("address");
  for (const order of orders) {
    if (order.shippingAddress.type === "addressId") {
      order.shippingAddress.addressDetails = user.address.id(order.shippingAddress.addressId);
    }
  }

  res.json(new APIResponse(200, orders, "User orders retrieved successfully"));
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;

  const query = {};
  if (status) {
    query.status = status;
  }
  if (startDate) {
    query.createdAt = { $gte: new Date(startDate) };
  }
  if (endDate) {
    query.createdAt = query.createdAt || {};
    query.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(query).populate({
    path: "items.variant",
    populate: [
      { path: "product", select: "name description" },
      { path: "color", select: "name hex" },
    ],
  }).populate("user", "name email").sort({ createdAt: -1 }).lean();


  for (const order of orders) {
    if (order.shippingAddress.type === "addressId") {
      const user = await User.findById(order.user._id).select("address");
      order.shippingAddress.addressDetails = user.address.id(order.shippingAddress.addressId);
    }
  }

  res.json(new APIResponse(200, orders, "All orders retrieved successfully"));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["processing", "shipped", "delivered", "cancelled"].includes(status)) {
    throw new APIError(400, "Invalid status");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new APIError(404, "Order not found");
  }

  if (order.status === "cancelled" || order.status === "delivered") {
    throw new APIError(400, "Cannot update status for this order");
  }

  order.status = status;
  await order.save();


  const populatedOrder = await Order.findById(order._id).populate({
    path: "items.variant",
    populate: [
      { path: "product", select: "name description" },
      { path: "color", select: "name hex" },
    ],
  }).lean();

  if (populatedOrder.shippingAddress.type === "addressId") {
    const user = await User.findById(populatedOrder.user).select("address");
    populatedOrder.shippingAddress.addressDetails = user.address.id(populatedOrder.shippingAddress.addressId);
  }

  res.json(new APIResponse(200, populatedOrder, "Order status updated successfully"));
});

module.exports = {
  createOrder,
  verifyPayment,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
};