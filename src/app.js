const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const CORS = require("cors");
const morgan = require("morgan");
app.use(morgan("dev"));
app.use(
  CORS({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
const errorMiddleware = require("./middlewares/error.middleware");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const colorRoutes = require("./routes/color.routes");
const variantRoutes = require("./routes/variant.routes");
const reviewRoutes = require("./routes/review.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const cartRoutes = require("./routes/cart.routes");
const contactRoutes = require("./routes/contact.routes");
const orderRoutes = require("./routes/order.routes");
const variantImageRoutes = require('./routes/variantImage.routes')
const dashboardRoutes = require('./routes/dashboard.routes')
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/color", colorRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/variant", variantRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/order", orderRoutes);
app.use("/api/v1/images", variantImageRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use(errorMiddleware);
module.exports = { app };
