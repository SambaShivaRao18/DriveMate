const express = require("express");
const router = express.Router();

const {
  geocodeAddress,
  createServiceRequest,
  getUserRequests,
  getProviderRequests,
  assignProviderToRequest,
  updateRequestStatus,
  getRequestDetails,
  uploadProblemPhotos,
  updateProblemDiagnosis,
  getProblemPhotos,
  findNearbyProviders,
  cancelServiceRequest
} = require("../controllers/serviceController");

const { protect } = require("../middleware/authMiddleware");
const { problemUpload } = require('../config/upload');

// @route   POST /api/services/geocode
// @desc    Geocode coordinates to address
router.post("/geocode", protect, geocodeAddress);

// @route   POST /api/services/find-providers
// @desc    Find nearby providers without creating service request
router.post("/find-providers", protect, findNearbyProviders);

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
// @desc    Assign provider to service request
router.put("/request/:requestId/assign", protect, assignProviderToRequest);

// @route   PUT /api/services/request/:requestId/status
// @desc    Update request status
router.put("/request/:requestId/status", protect, updateRequestStatus);

// @route   PUT /api/services/request/:requestId/cancel
// @desc    Cancel service request
router.put("/request/:requestId/cancel", protect, cancelServiceRequest);

// @route   GET /api/services/request/:requestId
// @desc    Get request details for tracking
router.get("/request/:requestId", protect, getRequestDetails);

// ======================
// PHOTO UPLOAD ROUTES
// ======================

// @route   POST /api/services/request/:requestId/upload-photos
// @desc    Upload problem photos for mechanic service
router.post("/request/:requestId/upload-photos",
  protect,
  problemUpload.array('photos', 5),
  uploadProblemPhotos
);

// @route   PUT /api/services/request/:requestId/diagnosis
// @desc    Update problem severity and diagnostic notes
router.put("/request/:requestId/diagnosis", protect, updateProblemDiagnosis);

// @route   GET /api/services/request/:requestId/photos
// @desc    Get problem photos for a request
router.get("/request/:requestId/photos", protect, getProblemPhotos);

// @route   GET /api/services/test
// @desc    Test service routes
router.get("/test", protect, (req, res) => {
  res.json({
    message: "Service routes working ✅",
    user: req.user.email,
    features: {
      photoUpload: "available",
      diagnosis: "available",
      geocoding: "available",
      findProviders: "available",
      cancelRequest: "available"
    }
  });
});

module.exports = router;