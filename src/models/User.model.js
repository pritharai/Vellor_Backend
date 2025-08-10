const { Schema, model } = require("mongoose");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "others"],
    },
    phone: {
      type: String,
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    refreshToken: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    passwordResetOtp: {
      type: String,
    },
    passwordResetOtpExpires: {
      type: Date,
    },
    emailVerificationOtp: {
      type: String,
    },
    emailVerificationOtpExpires: {
      type: Date,
    },
    address: [
      {
        houseNumber: {
          type: String,
          required: true,
        },
        street: {
          type: String,
          required: true,
        },
        colony: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
        },
        country: {
          type: String,
          required: true,
        },
        postalCode: {
          type: String,
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

// Hashing before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// checking Pass
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// generating tokens
userSchema.methods.generateAccessToken = function () {
  return JWT.sign(
    {
      _id: this._id,
      email: this.email,
      name: this.name,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return JWT.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET_KEY,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generatePasswordResetOTP = async function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetOtp = await bcrypt.hash(otp, 10);
  this.passwordResetOtpExpires = Date.now() + 1000 * 60 * 10; // 10 min
  await this.save();
  return otp;
};

userSchema.methods.verifyPasswordResetOTP = async function (otp) {
  if (!this.passwordResetOtp || !this.passwordResetOtpExpires) return false;
  if (Date.now() > this.passwordResetOtpExpires) {
    this.passwordResetOtpExpires = undefined;
    this.passwordResetOtp = undefined;
    await this.save();
    return false;
  }
  const isValid = await bcrypt.compare(otp, this.passwordResetOtp);
  if (isValid) {
    this.passwordResetOtpExpires = undefined;
    this.passwordResetOtp = undefined;
    await this.save();
  }
  return isValid;
};

userSchema.methods.generateEmailVerificationOTP = async function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(otp)
  this.emailVerificationOtp = await bcrypt.hash(otp, 10);
  console.log("hashed", this.emailVerificationOtp)
  this.emailVerificationOtpExpires = Date.now() + 1000 * 60 * 10; // 10 min
  await this.save();
  return otp;
};

userSchema.methods.verifyEmailVerificationOTP = async function (otp) {
  if (!this.emailVerificationOtp || !this.emailVerificationOtpExpires)
    return false;
  if (Date.now() > this.emailVerificationOtpExpires) {
    this.emailVerificationOtp = undefined;
    this.emailVerificationOtpExpires = undefined;
    await this.save();
    return false;
  }
  const isValid = await bcrypt.compare(otp, this.emailVerificationOtp);
  if (isValid) {
    this.isVerified = true;
    this.emailVerificationOtp = undefined;
    this.emailVerificationOtpExpires = undefined;
    await this.save();
  }
  return isValid;
};

const User = model("User", userSchema);
module.exports = User;
