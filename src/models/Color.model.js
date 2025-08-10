const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  hex: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
colorSchema.index({ name: 'text' });
const Color = mongoose.model('Color', colorSchema);

module.exports = Color;