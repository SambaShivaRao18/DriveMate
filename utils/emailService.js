const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config();

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@drivemate.com';
    
    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
      console.log('✅ SendGrid email service initialized and ready!');
    } else {
      console.log('📧 Email service in DEMO mode - Add SENDGRID_API_KEY to .env');
    }
  }

  async sendEmail(to, subject, html) {
    try {
      console.log(`📧 Attempting to send email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);
      
      // Demo mode fallback
      if (!this.apiKey) {
        console.log('📧 DEMO MODE - Email would be sent to:', to);
        console.log('📧 Email content:', html.substring(0, 200) + '...');
        return true;
      }

      const msg = {
        to: to,
        from: this.fromEmail,
        subject: subject,
        html: html,
      };

      const response = await sgMail.send(msg);
      console.log(`✅ EMAIL SENT SUCCESSFULLY to: ${to}`);
      console.log(`✅ SendGrid Response:`, response[0].statusCode);
      return true;

    } catch (error) {
      console.error('❌ SendGrid email failed:', error.response?.body || error.message);
      return false;
    }
  }

  // 1. Send welcome email to newly registered users
  async sendWelcomeEmail(userEmail, userName) {
    const subject = `Welcome to DriveMate 🚗 - Your Roadside Assistance Partner`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3366cc; margin-bottom: 10px;">🚗 DriveMate</h1>
          <p style="color: #666; font-size: 16px;">Roadside Assistance Reimagined</p>
        </div>
        
        <h2 style="color: #333;">Welcome to DriveMate, ${userName}! 👋</h2>
        
        <p>We're thrilled to have you on board. Now you can get instant help for:</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <span style="font-size: 24px; margin-right: 15px;">⛽</span>
            <div>
              <h3 style="margin: 0; color: #333;">Fuel Assistance</h3>
              <p style="margin: 5px 0 0 0; color: #666;">Get fuel delivered to your location within minutes</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 15px;">🔧</span>
            <div>
              <h3 style="margin: 0; color: #333;">Mechanical Help</h3>
              <p style="margin: 5px 0 0 0; color: #666;">Expert mechanics for all vehicle types and issues</p>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://drivemateweb.onrender.com/dashboard" 
             style="background: #3366cc; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;
                    display: inline-block;">
            Get Started Now
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            Need help? Visit: <a href="https://drivemateweb.onrender.com">drivemateweb.onrender.com</a>
          </p>
        </div>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }

  // 2. Send service completion email to both user and provider
  async sendServiceCompletionEmail(userEmail, userName, providerEmail, providerName, requestId, amount, serviceType) {
    const userSubject = `Service Completed ✅ - DriveMate #${requestId}`;
    const providerSubject = `Service Completed Successfully - #${requestId}`;

    // Email to User
    const userHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin-bottom: 10px;">✅ Service Completed</h1>
        </div>
        
        <h2>Great news, ${userName}! 🎉</h2>
        <p>Your ${serviceType} service has been completed successfully.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Service Details</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0;"><strong>Request ID:</strong></td>
              <td style="padding: 8px 0;">${requestId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Service Type:</strong></td>
              <td style="padding: 8px 0;">${serviceType === 'fuel' ? '⛽ Fuel Delivery' : '🔧 Mechanical Help'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Service Provider:</strong></td>
              <td style="padding: 8px 0;">${providerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
              <td style="padding: 8px 0; font-weight: bold; color: #28a745;">₹${amount}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://drivemateweb.onrender.com/dashboard" 
             style="background: #28a745; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Make Payment & Rate Service
          </a>
        </div>
      </div>
    `;

    // Email to Provider
    const providerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin-bottom: 10px;">✅ Service Completed</h1>
        </div>
        
        <h2>Great job, ${providerName}! 🎉</h2>
        <p>You have successfully completed service request <strong>#${requestId}</strong>.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Service Summary</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0;"><strong>Request ID:</strong></td>
              <td style="padding: 8px 0;">${requestId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Service Type:</strong></td>
              <td style="padding: 8px 0;">${serviceType === 'fuel' ? '⛽ Fuel Delivery' : '🔧 Mechanical Help'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Amount Earned:</strong></td>
              <td style="padding: 8px 0; font-weight: bold; color: #28a745;">₹${amount}</td>
            </tr>
          </table>
        </div>
        
        <p>Thank you for providing excellent service!</p>
      </div>
    `;

    const results = [];
    
    // Send to user
    const userResult = await this.sendEmail(userEmail, userSubject, userHtml);
    results.push({ to: 'user', success: userResult });
    
    // Send to provider
    if (providerEmail) {
      const providerResult = await this.sendEmail(providerEmail, providerSubject, providerHtml);
      results.push({ to: 'provider', success: providerResult });
    }
    
    return results;
  }

  // 3. Send profile update confirmation email
  async sendProfileUpdateEmail(userEmail, userName) {
    const subject = `Profile Updated 🔐 - DriveMate`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3366cc; margin-bottom: 10px;">🔐 Profile Updated</h1>
        </div>
        
        <h2>Hi ${userName},</h2>
        
        <p>Your DriveMate profile has been updated successfully.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="text-align: center;">
            <span style="font-size: 48px; color: #28a745;">✅</span>
            <h3 style="color: #28a745; margin: 10px 0;">Update Confirmed</h3>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://drivemateweb.onrender.com/dashboard" 
             style="background: #3366cc; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            View Updated Profile
          </a>
        </div>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }

  // Keep existing methods for backward compatibility
  async sendPaymentReceipt(userEmail, userName, paymentDetails) {
    const subject = `Payment Receipt - DriveMate #${paymentDetails.requestId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Receipt</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for your payment. Here's your receipt:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Request ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${paymentDetails.requestId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Service Type:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${paymentDetails.serviceType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Paid:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">₹${paymentDetails.amount}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Method:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${paymentDetails.paymentMethod}</td>
          </tr>
        </table>
        
        <p>Best regards,<br>DriveMate Team</p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }

  async sendServiceCompletion(userEmail, userName, serviceDetails) {
    const subject = `Service Completed - DriveMate #${serviceDetails.requestId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Service Completed</h2>
        <p>Hello ${userName},</p>
        <p>Your ${serviceDetails.serviceType} service has been completed successfully!</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Request ID:</strong> ${serviceDetails.requestId}</p>
          <p><strong>Service Provider:</strong> ${serviceDetails.providerName}</p>
          <p><strong>Total Amount:</strong> ₹${serviceDetails.amount}</p>
        </div>
        
        <p>Thank you for choosing DriveMate!</p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }
}

module.exports = new EmailService();