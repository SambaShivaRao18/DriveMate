
const profileController = require("../controllers/profileController");
const express = require("express");
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  logoutUser,
  showLogin,
  showRegister,
  showDashboard
} = require("../controllers/authController");

// Import auth middleware
const { protect } = require("../middleware/authMiddleware");

// ======================
// PAGE ROUTES (GET)
// ======================

// @route   GET /auth/login
// @desc    Show login page
router.get("/login", showLogin);

// @route   GET /auth/register
// @desc    Show register page
router.get("/register", showRegister);

// @route   GET /auth/dashboard
// @desc    Show user dashboard (protected)
router.get("/dashboard", protect, showDashboard);

// @route   GET /auth/logout
// @desc    Logout user
router.get("/logout", logoutUser);

// @desc    Show user profile based on role
router.get("/profile", protect, (req, res) => {
  if (req.user.role === 'traveller') {
    return profileController.showTravellerProfile(req, res);
  } else {
    return profileController.showProviderProfile(req, res);
  }
});

// ======================
// API ROUTES (POST)
// ======================

// @route   POST /auth/register
// @desc    Register new user
router.post("/register", registerUser);

// @route   POST /auth/login
// @desc    Login user
router.post("/login", loginUser);

// @route   PUT /auth/profile/update
// @desc    Update user profile
router.put("/profile/update", protect, profileController.updateUserProfile);

// @route   PUT /auth/profile/provider/update
// @desc    Update provider profile
router.put("/profile/provider/update", protect, profileController.updateProviderProfile);

// ======================
// TEST ROUTE
// ======================

// @route   GET /auth
// @desc    Test auth route
router.get("/", (req, res) => {
  res.json({ 
    message: "Auth Route Working ✅",
    endpoints: {
      login: {
        get: "/auth/login",
        post: "/auth/login"
      },
      register: {
        get: "/auth/register", 
        post: "/auth/register"
      },
      dashboard: "/auth/dashboard",
      logout: "/auth/logout"
    }
  });
});

module.exports = router;