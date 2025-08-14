const {
  login_user,
  logout_user,
  register_user,
  resend_otp,
  verify_user,
  changeCurrentPassword,
  forgotPassword,
  passwordReset,
  getUserProfile,
  refreshAccessToken,
  updateUserProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddressById,
  getAllAddresses
} = require("../controllers/user.controller");
const verifyJWT = require("../middlewares/auth.middleware");
const router = require("express").Router();

router.post("/register", register_user);
router.post("/resend_otp", resend_otp);
router.post("/verify_user", verify_user);
router.post("/login", login_user);
router.get("/logout", logout_user);
router.post("/change_password", verifyJWT, changeCurrentPassword);
router.post("/forgot_password", forgotPassword);
router.post("/reset_password", passwordReset);
router.get("/me", verifyJWT, getUserProfile);
router.post("/refresh_access_token", refreshAccessToken);
router.post("/update_userProfile", verifyJWT, updateUserProfile);
router.post("/add_address", verifyJWT, addAddress);
router.get("/address", verifyJWT,getAllAddresses );
router.get("/address/:id", verifyJWT,getAddressById );
router.patch("/update_address/:id", verifyJWT, updateAddress);
router.delete("/delete_address/:id", verifyJWT, deleteAddress);
module.exports = router;
