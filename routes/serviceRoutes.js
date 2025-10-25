const express = require("express");
const router = express.Router();
const {
  geocodeAddress,
  createServiceRequest,
  getUserRequests,
  getProviderRequests,
  assignProviderToRequest,
  updateRequestStatus,
  getRequestDetails
} = require("../controllers/serviceController");

const { protect } = require("../middleware/authMiddleware");

// @route   POST /api/services/geocode
// @desc    Geocode coordinates to address
router.post("/geocode", protect, geocodeAddress);

// @route   POST /api/services/request
// @desc    Create new service request
router.post("/request", protect, createServiceRequest);

// @route   GET /api/services/my-requests
// @desc    Get user service requests
router.get("/my-requests", protect, getUserRequests);

// @route   GET /api/services/provider-requests
// @desc    Get provider dashboard data
router.get("/provider-requests", protect, getProviderRequests);

// @route   PUT /api/services/request/:requestId/assign
// @desc    Assign provider to service request - ADDED MISSING ROUTE
router.put("/request/:requestId/assign", protect, assignProviderToRequest);

// @route   PUT /api/services/request/:requestId/status
// @desc    Update request status
router.put("/request/:requestId/status", protect, updateRequestStatus);

// @route   GET /api/services/request/:requestId
// @desc    Get request details for tracking
router.get("/request/:requestId", protect, getRequestDetails);

// @route   GET /api/services/test
// @desc    Test service routes
router.get("/test", protect, (req, res) => {
  res.json({
    message: "Service routes working ✅",
    user: req.user.email
  });
});

module.exports = router;