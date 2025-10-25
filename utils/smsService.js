const axios = require('axios');

class SMSService {
  constructor() {
    this.apiKey = process.env.SMS_API_KEY || 'demo';
    this.senderId = process.env.SMS_SENDER_ID || 'ROADSIDE';
  }

  // Send SMS using a free SMS API (like MSG91, TextLocal, etc.)
  async sendSMS(phoneNumber, message) {
    try {
      // For demo purposes - in production, integrate with actual SMS provider
      console.log(`📱 SMS to ${phoneNumber}: ${message}`);
      
      // Example with MSG91 (you'll need to sign up for actual service)
      if (process.env.NODE_ENV === 'production' && this.apiKey !== 'demo') {
        const response = await axios.post('https://api.msg91.com/api/v2/sendsms', {
          sender: this.senderId,
          route: '4',
          country: '91',
          sms: [
            {
              message: message,
              to: [phoneNumber.replace('+91', '')]
            }
          ]
        }, {
          headers: {
            'authkey': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
        return response.data;
      } else {
        // Demo mode - just log the message
        console.log('DEMO SMS:', { phoneNumber, message });
        return { type: 'demo', message: 'SMS sent in demo mode' };
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      // Fail silently - don't break the app if SMS fails
      return { error: 'SMS failed' };
    }
  }

  // Send request confirmation to user
  async sendRequestConfirmation(userPhone, requestId, serviceType) {
    const message = `Your ${serviceType} assistance request #${requestId} has been received. Help is on the way! - Roadside Assistance`;
    return await this.sendSMS(userPhone, message);
  }

  // Send provider assignment notification to user
  async sendProviderAssigned(userPhone, providerName, providerPhone, eta) {
    const message = `Great news! ${providerName} is coming to help you. Contact: ${providerPhone}. ETA: ${eta} mins. - Roadside Assistance`;
    return await this.sendSMS(userPhone, message);
  }

  // Send service completion notification to user
  async sendServiceCompleted(userPhone, requestId, amount) {
    const message = `Service #${requestId} completed! Amount: ₹${amount}. Please make payment in the app. Thank you! - Roadside Assistance`;
    return await this.sendSMS(userPhone, message);
  }

  // Send new request notification to provider
  async sendNewRequestAlert(providerPhone, serviceType, distance) {
    const message = `New ${serviceType} request nearby! ${distance}km away. Check your dashboard now! - Roadside Assistance`;
    return await this.sendSMS(providerPhone, message);
  }
}

module.exports = new SMSService();