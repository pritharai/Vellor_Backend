require("dotenv").config({
    path: "./.env",
  });
  const fs = require("fs");
  const cloudinary = require("cloudinary").v2;
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  
  const uploadOnCloudinary = async (localFilePath) => {
    try {
      if (!localFilePath) {
        return null;
      }
      const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "image",
      });
      fs.unlinkSync(localFilePath);
      return response;
    } catch (error) {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      console.error("Error uploading on Cloudinary:", error);
      return null;
    }
  };
  
  const removeFromCloudinary = async (publicId) => {
    try {
      if (!publicId) return null;
  
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });
  
      return result;
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
      return null;
    }
  };
  
  module.exports = {
    uploadOnCloudinary,
    removeFromCloudinary,
  };
  