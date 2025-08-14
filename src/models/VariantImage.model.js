const mongoose = require('mongoose');

const variantImageSchema = new mongoose.Schema({
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant',
    required: true,
    unique: true, 
  },
  images: [
    {
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

variantImageSchema.index({ variant: 1 });

const VariantImage = mongoose.model('VariantImage', variantImageSchema);

module.exports = VariantImage;