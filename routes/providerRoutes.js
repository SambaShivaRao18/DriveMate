
const express = require("express");
const router = express.Router();
const {
    showProviderRegister,
    registerProvider,
    showProviderDashboard
} = require("../controllers/providerController");

const { protect } = require("../middleware/authMiddleware");

// @route   GET /provider/register
// @desc    Show provider registration page
router.get("/register", protect, showProviderRegister);

// @route   POST /provider/register  
// @desc    Register service provider
router.post("/register", protect, registerProvider);

// @route   GET /provider/dashboard
// @desc    Show provider dashboard
router.get("/dashboard", protect, showProviderDashboard);

module.exports = router;