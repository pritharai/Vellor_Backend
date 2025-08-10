const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    required: true,
  },
  quantity: {
    type: Map,
    of: Number,
    required: true,
    validate: {
      validator: function (value) {
        const validSizes = ['M', 'L', 'XL', 'XXL'];
        return (
          value.size > 0 &&
          Array.from(value.keys()).every(key => validSizes.includes(key)) &&
          Array.from(value.values()).every(val => Number.isInteger(val) && val >= 0)
        );
      },
      message: 'Quantity must be a map with valid sizes (M, L, XL, XXL) and non-negative integer stock values',
    },
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  sku: {
    type: String,
    trim: true,
  },
  image: {
    url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique product-color combination
variantSchema.index({ product: 1, color: 1 }, { unique: true });

const Variant = mongoose.model('Variant', variantSchema);

module.exports = Variant;