const { Schema, model } = require("mongoose");

const wishlistSchema = new Schema({
  variant: {
    type: Schema.Types.ObjectId,
    ref: "Variant",
    required: true,
  },
  size: {
    type: String,
    required: true,
    enum: ['M', 'L', 'XL', 'XXL'],
    trim: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

wishlistSchema.index({ user: 1, variant: 1, size: 1 }, { unique: true });

const Wishlist = model('Wishlist', wishlistSchema);

module.exports = Wishlist;