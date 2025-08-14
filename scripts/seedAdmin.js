require("dotenv").config({
  path: "./.env",
});
const mongoose = require("mongoose");
const User = require("../src/models/User.model");
const { DB_NAME } = require("../src/constants");

const seedAdmin = async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
    console.log("MongoDB Connected Successfully");
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME)
      throw new Error("Missing Admin credentials in .env");

    const isExistingAdmin = await User.findOne({role:"admin"}) 
    if(isExistingAdmin) {
        console.log("Admin already exist with email: ",isExistingAdmin.email)
        return;
    }
    const admin = new User({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role:'admin',
        isVerified:true
    })
    await admin.save();

    console.log("Admin hash password: ",admin.password)
    console.log("Admin created successfully")
  } catch (error) {
    console.log("Error Seeding Admin: ", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();
