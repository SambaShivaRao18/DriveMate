const express = require("express");
const router = express.Router();
const notificationService = require("../utils/notificationService");
const { protect } = require("../middleware/authMiddleware");

// Get user notifications
router.get("/my-notifications", protect, async (req, res) => {
  try {
    const result = await notificationService.getUserNotifications(req.user._id, 20);
    
    if (result.success) {
      res.json({
        success: true,
        notifications: result.notifications
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get notifications"
    });
  }
});

// Get unread notification count
router.get("/unread-count", protect, async (req, res) => {
  try {
    const result = await notificationService.getUnreadCount(req.user._id);
    
    if (result.success) {
      res.json({
        success: true,
        count: result.count
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get unread count"
    });
  }
});

// Mark notification as read
router.put("/:id/read", protect, async (req, res) => {
  try {
    const result = await notificationService.markAsRead(req.params.id, req.user._id);
    
    if (result.success) {
      res.json({
        success: true,
        message: "Notification marked as read"
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read"
    });
  }
});

// Mark all notifications as read
router.put("/mark-all-read", protect, async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    
    if (result.success) {
      res.json({
        success: true,
        message: "All notifications marked as read"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notifications as read"
    });
  }
});

module.exports = router;