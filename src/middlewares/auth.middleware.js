require("dotenv").config({
  path: "./.env",
});

const JWT = require("jsonwebtoken");
const APIError = require("../utils/API/APIError");
const asyncHandler = require("../utils/API/asyncHandler");
const User = require('../models/User.model')
const verifyJWT = asyncHandler(async (req, _ , next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith("Bearer") &&
        req.headers.authorization.split(" ")[1]);

    if (!token) throw new APIError(401, "No Access Token Provided");

    const decodedToken = await JWT.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    const user = await User.findById(decodedToken?._id).select(
      "-refreshToken -password"
    );
    if (!user) throw new APIError(401, "Invalid Access Token");
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new APIError(401, "Access token expired");
    }
    throw new APIError(401, error.message || "Invalid access token");
  }
});

module.exports = verifyJWT;
