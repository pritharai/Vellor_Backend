const Order = require("../models/Order.model");
const Cart = require("../models/Cart.model");
const Variant = require("../models/Variant.model");
const User = require("../models/User.model");
const Product = require("../models/Product.model");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");
const { sendEmail } = require("../utils/email");

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
  const user = await User.findById(userId).select("address name email");
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
    const { houseNumber, street, colony, city, state, country, postalCode } =
      shippingAddress;
    if (
      !houseNumber ||
      !street ||
      !colony ||
      !city ||
      !state ||
      !country ||
      !postalCode
    ) {
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

    const expectedDelivery = new Date();
    expectedDelivery.setDate(
      expectedDelivery.getDate() + Number(process.env.EXPECTED_DELIVERY)
    );

    const prepareOrderItems = async (items) => {
      let totalAmount = 0;
      let orderItems = [];
      for (const item of items) {
        const variant = await Variant.findById(item.variant).session(session);
        if (!variant)
          throw new APIError(404, `Variant ${item.variant} not found`);
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

    const { totalAmount, orderItems } = await prepareOrderItems(selectedItems);

    let razorpayOrder = null;
    if (selectedPaymentMethod === "online") {
      razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });
    }

    if (selectedPaymentMethod === "cod") {
      for (const item of orderItems) {
        const variant = await Variant.findById(item.variant).session(session);
        if (variant) {
          const currentStock = variant.quantity.get(item.size) || 0;
          variant.quantity.set(
            item.size,
            Math.max(0, currentStock - item.quantity)
          );
          await variant.save({ session });
        }
      }
    }

    const order = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          totalAmount,
          status: selectedPaymentMethod === "cod" ? "processing" : "pending",
          paymentStatus:
            selectedPaymentMethod === "cod" ? "completed" : "pending",
          razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
          shippingAddress: orderShippingAddress,
          expectedDelivery,
          paymentMethod: selectedPaymentMethod,
        },
      ],
      { session }
    );

    if (itemIds && itemIds.length > 0) {
      cart.items = cart.items.filter(
        (item) => !itemIds.includes(item._id.toString())
      );
    } else {
      cart.items = [];
    }
    await cart.save({ session });

    await session.commitTransaction();

    const populatedOrder = await Order.findById(order[0]._id)
      .populate({
        path: "items.variant",
        populate: [
          { path: "product", select: "name description" },
          { path: "color", select: "name hex" },
        ],
      })
      .lean();

    const orderConfirmedMail = {
      from: process.env.NODEMAILER_USER,
      to: user.email,
      subject: "Your Order is Confirmed",
      html: `
        <div style="max-width: 500px; margin: auto; padding: 20px; background: #ffffff; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #28a745;">Order Confirmed ✅</h2>
          <p style="font-size: 16px; color: #555;">
            Hello, ${user.name}<br/><br/>
            Thank you for shopping with us! Your order <strong>#${order[0]._id}</strong> has been successfully confirmed.
          </p>
          <p style="font-size: 14px; color: #888;">
            We’ll notify you once it is shipped.
          </p>
          <p style="font-size: 14px; color: #aaa; margin-top: 30px;">
            – Vellor Team
          </p>
        </div>`,
    };
    await sendEmail(orderConfirmedMail);

    res
      .status(201)
      .json(
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

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order.razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new APIError(400, "Invalid payment signature");
  }

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.paymentStatus = "completed";
  order.status = "processing";

  for (const item of order.items) {
    const variant = await Variant.findById(item.variant);
    if (variant) {
      const currentStock = variant.quantity.get(item.size) || 0;
      variant.quantity.set(
        item.size,
        Math.max(0, currentStock - item.quantity)
      );
      await variant.save();
    }
  }

  await order.save();

  const populatedOrder = await Order.findById(order._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  const user = await User.findById(userId).select("name email");
  const orderConfirmedMail = {
    from: process.env.NODEMAILER_USER,
    to: user.email,
    subject: "Your Order is Confirmed",
    html: `
      <div style="max-width: 500px; margin: auto; padding: 20px; background: #ffffff; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif;">
        <h2 style="text-align: center; color: #28a745;">Order Confirmed ✅</h2>
        <p style="font-size: 16px; color: #555;">
          Hello, ${user.name}<br/><br/>
          Thank you for shopping with us! Your order <strong>#${order._id}</strong> has been successfully confirmed.
        </p>
        <p style="font-size: 14px; color: #888;">
          We’ll notify you once it is shipped.
        </p>
        <p style="font-size: 14px; color: #aaa; margin-top: 30px;">
          – Vellor Team
        </p>
      </div>`,
  };
  await sendEmail(orderConfirmedMail);

  res.json(
    new APIResponse(
      200,
      populatedOrder,
      "Payment verified and order processed successfully"
    )
  );
});

const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to view orders");
  }

  const orders = await Order.find({ user: userId })
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  res.json(new APIResponse(200, orders, "User orders retrieved successfully"));
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, limit = 10, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const validStatuses = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  if (status && !validStatuses.includes(status)) {
    throw new APIError(400, "Invalid status filter");
  }
  if (startDate && isNaN(new Date(startDate).getTime())) {
    throw new APIError(400, "Invalid startDate format");
  }
  if (endDate && isNaN(new Date(endDate).getTime())) {
    throw new APIError(400, "Invalid endDate format");
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new APIError(400, "startDate cannot be after endDate");
  }

  const query = {};
  if (status) query.status = status;
  if (startDate) query.createdAt = { $gte: new Date(startDate) };
  if (endDate) {
    query.createdAt = query.createdAt || {};
    query.createdAt.$lte = new Date(endDate);
  }

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
  const totalPages = Math.ceil(totalOrders / parseInt(limit));

  res.json(
    new APIResponse(
      200,
      {
        orders,
        totalOrders,
        currentPage: parseInt(page),
        totalPages,
      },
      "All orders retrieved successfully"
    )
  );
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

  const user = await User.findById(order.user).select("name email");
  order.status = status;
  await order.save();

  const populatedOrder = await Order.findById(order._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  if (status === "shipped") {
    const trackingId = `TRACK${order._id.toString().slice(-6)}`; // Placeholder; replace with actual tracking logic
    const orderShippedMail = {
      from: process.env.NODEMAILER_USER,
      to: user.email,
      subject: "Your Order is Shipped",
      html: `
        <div style="max-width: 500px; margin: auto; padding: 20px; background: #ffffff; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #007bff;">Order Shipped 🚚</h2>
          <p style="font-size: 16px; color: #555;">
            Hello, ${user.name}<br/><br/>
            Good news! Your order <strong>#${order._id}</strong> has been shipped.
          </p>
          <p style="font-size: 14px; color: #888;">
            Track your package using the tracking ID: <strong>${trackingId}</strong>.
          </p>
          <p style="font-size: 14px; color: #aaa; margin-top: 30px;">
            – Vellor Team
          </p>
        </div>`,
    };
    await sendEmail(orderShippedMail);
  } else if (status === "delivered") {
    const orderDeliveredMail = {
      from: process.env.NODEMAILER_USER,
      to: user.email,
      subject: "Your Order has been Delivered",
      html: `
        <div style="max-width: 500px; margin: auto; padding: 20px; background: #ffffff; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #28a745;">Order Delivered 🎉</h2>
          <p style="font-size: 16px; color: #555;">
            Hello, ${user.name}<br/><br/>
            Your order <strong>#${order._id}</strong> has been successfully delivered.
          </p>
          <p style="font-size: 14px; color: #888;">
            We hope you enjoy your purchase! Don’t forget to leave a review.
          </p>
          <p style="font-size: 14px; color: #aaa; margin-top: 30px;">
            – Vellor Team
          </p>
        </div>`,
    };
    await sendEmail(orderDeliveredMail);
  }

  res.json(
    new APIResponse(200, populatedOrder, "Order status updated successfully")
  );
});

const requestOrderCancellation = asyncHandler(async (req, res) => {
  const { orderId, reason } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to request cancellation");
  }
  if (!orderId || !mongoose.isValidObjectId(orderId)) {
    throw new APIError(400, "Valid orderId is required");
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    throw new APIError(400, "Cancellation reason is required");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new APIError(404, "Order not found");
  }
  if (order.user.toString() !== userId.toString()) {
    throw new APIError(
      403,
      "You can only request cancellation for your own order"
    );
  }
  if (order.status === "cancelled" || order.status === "delivered") {
    throw new APIError(400, "Order cannot be cancelled");
  }
  if (order.cancellationRequest.requested) {
    throw new APIError(400, "Cancellation request already submitted");
  }

  order.cancellationRequest = {
    requested: true,
    reason: reason.trim(),
    requestedAt: new Date(),
  };
  await order.save();

  const user = await User.findById(userId).select("name email phone");
  const populatedOrder = await Order.findById(order._id)
    .populate({
      path: "items.variant",
      populate: [
        { path: "product", select: "name description" },
        { path: "color", select: "name hex" },
      ],
    })
    .lean();

  const cancellationRequestMail = {
    from: process.env.NODEMAILER_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `Order Cancellation Request #${order._id}`,
    html: `
      <div style="max-width: 600px; margin: auto; padding: 20px; background: #ffffff; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif;">
        <h2 style="text-align: center; color: #dc3545;">Order Cancellation Request</h2>
        <p style="font-size: 16px; color: #555;">
          A cancellation request has been submitted for order <strong>#${
            order._id
          }</strong>.
        </p>
        <h3 style="color: #333;">Order Details:</h3>
        <ul style="font-size: 14px; color: #555;">
          <li><strong>User:</strong> ${user.name} (${user.email}, ${
      user.phone || "N/A"
    })</li>
          <li><strong>Order ID:</strong> ${order._id}</li>
          <li><strong>Total Amount:</strong> ₹${order.totalAmount}</li>
          <li><strong>Payment Method:</strong> ${order.paymentMethod}</li>
          <li><strong>Status:</strong> ${order.status}</li>
          <li><strong>Cancellation Reason:</strong> ${
            order.cancellationRequest.reason
          }</li>
          <li><strong>Requested At:</strong> ${order.cancellationRequest.requestedAt.toISOString()}</li>
        </ul>
        <h3 style="color: #333;">Items:</h3>
        <ul style="font-size: 14px; color: #555;">
          ${populatedOrder.items
            .map(
              (item) => `
            <li>
              ${item.variant.product.name} (${item.variant.color.name}, ${item.size}) - 
              Quantity: ${item.quantity}, Price: ₹${item.price}
            </li>`
            )
            .join("")}
        </ul>
        <h3 style="color: #333;">Shipping Address:</h3>
        <p style="font-size: 14px; color: #555;">
          ${populatedOrder.shippingAddress.houseNumber}, ${
      populatedOrder.shippingAddress.street
    }, 
          ${populatedOrder.shippingAddress.colony}, ${
      populatedOrder.shippingAddress.city
    }, 
          ${populatedOrder.shippingAddress.state}, ${
      populatedOrder.shippingAddress.country
    }, 
          ${populatedOrder.shippingAddress.postalCode}
        </p>
        <p style="font-size: 14px; color: #888;">
          Please review the request and update the order status accordingly.
        </p>
        <p style="font-size: 14px; color: #aaa; margin-top: 30px;">
          – Vellor Admin
        </p>
      </div>`,
  };
  await sendEmail(cancellationRequestMail);

  res.json(
    new APIResponse(
      200,
      populatedOrder,
      "Cancellation request submitted successfully"
    )
  );
});

module.exports = {
  createOrder,
  verifyPayment,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  requestOrderCancellation,
};
