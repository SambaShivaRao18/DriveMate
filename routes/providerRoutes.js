const express = require("express");
const multer = require('multer'); // ADD THIS IMPORT
const router = express.Router();

const {
    showProviderRegister,
    registerProvider,
    showProviderDashboard,
    getProviderProfile,
    toggleAvailability,
    getProviderActiveRequests,
    updateProviderLocation,
    assignProviderToRequest,
    updateProviderQRCode,
    showEditProfile,
    updateProviderProfile,
    deleteBusinessPhoto
} = require("../controllers/providerController");

const { protect } = require("../middleware/authMiddleware");
const { storage, handleUploadErrors } = require('../config/upload'); // CHANGED IMPORT

// PAGE ROUTES
router.get("/register", protect, showProviderRegister);
router.get("/dashboard", protect, showProviderDashboard);
router.get("/edit-profile", protect, showEditProfile);

// API ROUTES
router.post("/register", protect, 
    multer({ 
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 4
      }
    }).any(),
    handleUploadErrors,
    registerProvider
);

router.get("/profile", protect, getProviderProfile);
router.put("/availability", protect, toggleAvailability);
router.get("/active-requests", protect, getProviderActiveRequests);
router.put("/location", protect, updateProviderLocation);

// PROFILE MANAGEMENT ROUTES
router.put("/update-profile", protect, 
    // Use multer with generous limits
    multer({ 
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 4 // Total files allowed
      }
    }).any(),
    handleUploadErrors,
    updateProviderProfile
);

router.delete("/business-photo/:photoIndex", protect, deleteBusinessPhoto);

module.exports = router;