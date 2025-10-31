const Notification = require('../models/Notification');

class NotificationService {
  
  // Create notification and save to database
  async createNotification(userId, type, title, message, data = {}) {
    try {
      const notification = new Notification({
        user: userId,
        type: type,
        title: title,
        message: message,
        data: data,
        isRead: false
      });
      
      await notification.save();
      console.log(`✅ Notification created for user: ${userId} - ${title}`);
      return { success: true, notification };
    } catch (error) {
      console.error('❌ Notification creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  // 1. Welcome notification for new users
  async sendWelcomeNotification(userId, userName) {
    return await this.createNotification(
      userId,
      'welcome',
      'Welcome to DriveMate! 🚗',
      `Hi ${userName}, welcome to your roadside assistance partner! Get instant help for fuel delivery and mechanical assistance.`,
      { 
        action: 'explore_services',
        link: '/dashboard'
      }
    );
  }

  // 2. Profile update notification
  async sendProfileUpdateNotification(userId, userName) {
    return await this.createNotification(
      userId,
      'profile_update',
      'Profile Updated ✅',
      `Hi ${userName}, your profile information has been updated successfully.`,
      { 
        action: 'view_profile',
        link: '/auth/profile'
      }
    );
  }

  // 3. Service completion notification
  async sendServiceCompletionNotification(userId, userName, requestId, amount) {
    return await this.createNotification(
      userId,
      'service_completion',
      'Service Completed 🎉',
      `Your service request #${requestId} has been completed successfully. Total amount: ₹${amount}.`,
      { 
        requestId: requestId,
        amount: amount,
        action: 'make_payment',
        link: '/dashboard'
      }
    );
  }

  // 4. Payment received notification
  async sendPaymentNotification(userId, userName, requestId, amount) {
    return await this.createNotification(
      userId,
      'payment',
      'Payment Received 💰',
      `Payment of ₹${amount} for service #${requestId} has been received successfully. Thank you!`,
      { 
        requestId: requestId,
        amount: amount,
        action: 'view_receipt',
        link: '/dashboard'
      }
    );
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 10) {
    try {
      const notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return { success: true, notifications };
    } catch (error) {
      console.error('❌ Get notifications failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { isRead: true },
        { new: true }
      );
      
      if (!notification) {
        return { success: false, error: 'Notification not found' };
      }
      
      return { success: true, notification };
    } catch (error) {
      console.error('❌ Mark as read failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { user: userId, isRead: false },
        { isRead: true }
      );
      
      return { success: true };
    } catch (error) {
      console.error('❌ Mark all as read failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get unread count
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({ 
        user: userId, 
        isRead: false 
      });
      
      return { success: true, count };
    } catch (error) {
      console.error('❌ Get unread count failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();