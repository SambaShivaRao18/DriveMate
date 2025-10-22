
const express = require("express");
const router = express.Router();
const {
  createServiceRequest,
  getUserRequests,
  getProviderRequests,
  geocodeAddress
} = require("../controllers/serviceController");

const { protect } = require("../middleware/authMiddleware");

// @route   POST /api/services/request
// @desc    Create new service request
router.post("/request", protect, createServiceRequest);

// @route   GET /api/services/my-requests
// @desc    Get user's service requests
router.get("/my-requests", protect, getUserRequests);

// @route   GET /api/services/provider-requests
// @desc    Get provider dashboard data
router.get("/provider-requests", protect, getProviderRequests);

// @route   POST /api/services/geocode
// @desc    Geocode coordinates to address
router.post("/geocode", protect, geocodeAddress);

// @route   GET /api/services/test
// @desc    Test service routes
router.get("/test", protect, (req, res) => {
  res.json({ 
    message: "Service routes working ✅",
    user: req.user.email
  });
});

module.exports = router;