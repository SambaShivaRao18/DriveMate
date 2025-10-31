const axios = require('axios');

class SMSService {
  constructor() {
    // KEEP OLD ENV VARIABLE FOR BACKWARD COMPATIBILITY
    this.apiKey = process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || 'demo';
    this.senderId = process.env.SMS_SENDER_ID || 'DRIVMT';
    this.dailyLimit = 10;
    this.smsCount = 0;
    this.lastReset = new Date().toDateString();
  }

  // Your existing sendSMS method with Fast2SMS ADDED as option
  async sendSMS(phoneNumber, message) {
    try {
      console.log(`📱 SMS to ${phoneNumber}: ${message}`);
      
      // DEMO MODE - If no API key or demo mode
      if (this.apiKey === 'demo' || !this.apiKey) {
        console.log('DEMO SMS:', { phoneNumber, message });
        return { type: 'demo', message: 'SMS sent in demo mode' };
      }

      // CHECK DAILY LIMIT (only for Fast2SMS)
      this.checkDailyLimit();

      // Clean phone number
      const cleanedNumber = phoneNumber.replace('+91', '').replace(/\D/g, '');
      
      if (cleanedNumber.length !== 10) {
        throw new Error('INVALID_PHONE_NUMBER');
      }

      // ✅ FAST2SMS IMPLEMENTATION
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanedNumber
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Fast2SMS Response:', response.data);
      
      if (response.data.return === true) {
        return {
          success: true,
          message: 'SMS sent successfully',
          messageId: response.data.request_id,
          provider: 'fast2sms'
        };
      } else {
        throw new Error(response.data.message || 'Fast2SMS API error');
      }

    } catch (error) {
      console.error('❌ SMS sending error:', error.message);
      
      // Handle specific Fast2SMS errors
      if (error.message === 'DAILY_LIMIT_EXCEEDED') {
        console.log(`📊 Daily SMS limit exceeded. Used: ${this.smsCount}/${this.dailyLimit}`);
        // FALLBACK TO DEMO MODE - NO BREAKING CHANGES
        console.log('DEMO SMS (Limit exceeded):', { phoneNumber, message });
        return { 
          type: 'demo', 
          message: 'SMS sent in demo mode (limit exceeded)',
          error: 'DAILY_LIMIT_EXCEEDED'
        };
      }
      
      // For other errors, fallback to demo mode
      console.log('DEMO SMS (API failed):', { phoneNumber, message });
      return { 
        type: 'demo', 
        message: 'SMS sent in demo mode (API failed)',
        error: error.message 
      };
    }
  }

  // DAILY LIMIT CHECK (only for Fast2SMS)
  checkDailyLimit() {
    const today = new Date().toDateString();
    
    if (today !== this.lastReset) {
      this.smsCount = 0;
      this.lastReset = today;
    }
    
    if (this.smsCount >= this.dailyLimit) {
      throw new Error('DAILY_LIMIT_EXCEEDED');
    }
    
    this.smsCount++;
  }

  // ✅ ALL YOUR EXISTING METHODS REMAIN EXACTLY THE SAME
  async sendRequestConfirmation(userPhone, requestId, serviceType) {
    const message = `Your ${serviceType} assistance request #${requestId} has been received. Help is on the way! - DriveMate`;
    return await this.sendSMS(userPhone, message);
  }

  async sendProviderAssigned(userPhone, providerName, providerPhone, eta) {
    const message = `Great news! ${providerName} is coming to help you. Contact: ${providerPhone}. ETA: ${eta} mins. - DriveMate`;
    return await this.sendSMS(userPhone, message);
  }

  async sendServiceCompleted(userPhone, requestId, amount) {
    const message = `Service #${requestId} completed! Amount: ₹${amount}. Please make payment in the app. Thank you! - DriveMate`;
    return await this.sendSMS(userPhone, message);
  }

  async sendNewRequestAlert(providerPhone, serviceType, distance) {
    const message = `New ${serviceType} request nearby! ${distance}km away. Check your dashboard now! - DriveMate`;
    return await this.sendSMS(providerPhone, message);
  }

  // ✅ NEW METHODS (optional - won't break anything)
  async sendWelcomeSMS(userPhone, userName) {
    const message = `Welcome ${userName} to DriveMate! Your roadside assistance partner.`;
    return await this.sendSMS(userPhone, message);
  }

  async sendProfileUpdateSMS(phoneNumber, userName) {
    const message = `Hi ${userName}, your DriveMate profile has been updated successfully.`;
    return await this.sendSMS(phoneNumber, message);
  }
}

module.exports = new SMSService();