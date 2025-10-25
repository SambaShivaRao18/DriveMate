const express = require("express");
const router = express.Router();
const {
    showProviderRegister,
    registerProvider,
    showProviderDashboard,
    getProviderProfile,
    toggleAvailability,
    getProviderActiveRequests,
    updateProviderLocation
} = require("../controllers/providerController");

const { protect } = require("../middleware/authMiddleware");

// PAGE ROUTES
router.get("/register", protect, showProviderRegister);
router.get("/dashboard", protect, showProviderDashboard);

// API ROUTES
router.post("/register", protect, registerProvider);
router.get("/profile", protect, getProviderProfile);
router.put("/availability", protect, toggleAvailability);
router.get("/active-requests", protect, getProviderActiveRequests);
router.put("/location", protect, updateProviderLocation);

module.exports = router;