const express = require("express");
const router = express.Router();
const {
  processPayment,
  getPaymentHistory,
  getProviderEarnings,
  submitRating
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

// @route   POST /api/payments/process
// @desc    Process payment for service request
router.post("/process", protect, processPayment);

// @route   GET /api/payments/history
// @desc    Get user payment history
router.get("/history", protect, getPaymentHistory);

// @route   GET /api/payments/earnings
// @desc    Get provider earnings
router.get("/earnings", protect, getProviderEarnings);

// @route   POST /api/payments/rating
// @desc    Submit rating and review
router.post("/rating", protect, submitRating);

// @route   GET /api/payments/test
// @desc    Test payment routes
router.get("/test", protect, (req, res) => {
  res.json({ 
    message: "Payment routes working ✅",
    user: req.user.email
  });
});

module.exports = router;