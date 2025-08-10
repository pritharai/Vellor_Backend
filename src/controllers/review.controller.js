const Review = require("../models/Review.model");
const Product = require("../models/Product.model");
const asyncHandler = require("../utils/API/asyncHandler");
const APIError = require("../utils/API/APIError");
const APIResponse = require("../utils/API/APIResponse");


const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user?._id; 

  if (!userId) {
    throw new APIError(401, "You must be logged in to submit a review");
  }

  if (!productId || !rating) {
    throw new APIError(400, "Product ID and rating are required");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new APIError(404, "Product not found");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new APIError(400, "Rating must be an integer between 1 and 5");
  }

  const reviewData = {
    product: productId,
    user: userId,
    rating,
    comment: comment?.trim() || undefined,
  };

  const existingReview = await Review.findOne({ product: productId, user: userId });

  if (existingReview) {
    existingReview.rating = rating;
    if (comment !== undefined) {
      existingReview.comment = comment?.trim() || undefined;
    }
    existingReview.createdAt = Date.now();
    await existingReview.save();
    return res.json(new APIResponse(200, existingReview, "Review updated successfully"));
  }

  
  const review = await Review.create(reviewData);
  res.status(201).json(new APIResponse(201, review, "Review created successfully"));
});

const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new APIError(401, "You must be logged in to delete a review");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new APIError(404, "Review not found");
  }

  if (review.user.toString() !== userId.toString()) {
    throw new APIError(403, "You can only delete your own review");
  }

  await review.deleteOne();
  res.json(new APIResponse(200, null, "Review deleted successfully"));
});

const getReviewsByProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    throw new APIError(404, "Product not found");
  }

  const reviews = await Review.find({ product: productId }).populate("user", "name email").lean();
  if (reviews.length === 0) {
    return res.json(new APIResponse(200, [], "No reviews found for this product"));
  }

  res.json(new APIResponse(200, reviews, "Reviews retrieved successfully"));
});



module.exports = {
    createReview,
    deleteReview,
    getReviewsByProduct,
}