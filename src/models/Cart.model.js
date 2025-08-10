const { Schema, model } = require("mongoose");

const cartItemSchema = new Schema({
  variant: {
    type: Schema.Types.ObjectId,
    ref: "Variant",
    required: true,
  },
  size: {
    type: String,
    required: true,
    enum: ["M", "L", "XL", "XXL"],
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be a positive integer",
    },
  },
});

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

cartSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Cart = model("Cart", cartSchema);

module.exports = Cart;
