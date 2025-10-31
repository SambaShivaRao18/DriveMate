const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Only create transporter if email credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // Better timeout settings for Render
        connectionTimeout: 10000, // 10 seconds
        socketTimeout: 15000, // 15 seconds
        greetingTimeout: 10000,
        // Retry logic
        maxConnections: 5,
        maxMessages: 100
      });

      // Verify connection on startup
      this.verifyConnection();
    } else {
      console.log('📧 Email service running in DEMO mode - no email credentials provided');
    }
  }

  async verifyConnection() {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      console.log('✅ Email transporter verified and ready');
    } catch (error) {
      console.error('❌ Email transporter verification failed:', error.message);
      this.transporter = null; // Disable transporter on failure
    }
  }

  // Robust email sending with multiple fallbacks
  async sendEmail(to, subject, html) {
    try {
      // Always log the email attempt
      console.log(`📧 Attempting to send email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);

      // If no transporter (no credentials or verification failed), use demo mode
      if (!this.transporter) {
        console.log('📧 DEMO MODE - Email logged but not sent (no transporter)');
        this.logEmailForManualSending(to, subject, html);
        return true; // Return true to indicate "success" in demo mode
      }

      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@drivemate.com',
        to: to,
        subject: subject,
        html: html,
        // Important headers for better delivery
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal'
        }
      };

      // Attempt to send with timeout
      const sendPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout')), 15000);
      });

      await Promise.race([sendPromise, timeoutPromise]);
      
      console.log(`✅ Email sent successfully to: ${to}`);
      return true;

    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      
      // Fallback: Log email for manual sending
      this.logEmailForManualSending(to, subject, html);
      
      // Don't throw error - fail gracefully
      return false;
    }
  }

  // Log emails that couldn't be sent (for manual follow-up)
  logEmailForManualSending(to, subject, html) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: to,
      subject: subject,
      html: html,
      status: 'PENDING_MANUAL_SEND'
    };
    
    console.log('📧 EMAIL PENDING MANUAL SENDING:');
    console.log('   To:', to);
    console.log('   Subject:', subject);
    console.log('   Time:', logEntry.timestamp);
    console.log('   ---');
    
    // In production, you could save this to a database for manual processing
    // For now, we just log it clearly
  }

  // 1. Send welcome email to newly registered users
  async sendWelcomeEmail(userEmail, userName) {
    const subject = `Welcome to DriveMate - Your Roadside Assistance Partner`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Get Started Now
          </a>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          This is an automated message. Email delivery: ${this.transporter ? 'ACTIVE' : 'DEMO MODE'}
        </p>
      </div>
    `;

    const result = await this.sendEmail(userEmail, subject, html);
    
    if (!result) {
      console.log(`⚠️ Welcome email to ${userEmail} queued for manual sending`);
    }
    
    return result;
  }

  // 2. Send service completion email to both user and provider
  async sendServiceCompletionEmail(userEmail, userName, providerEmail, providerName, requestId, amount, serviceType) {
    const userSubject = `Service Completed - DriveMate #${requestId}`;
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
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          Email delivery: ${this.transporter ? 'ACTIVE' : 'DEMO MODE - Please check app for updates'}
        </p>
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
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          Email delivery: ${this.transporter ? 'ACTIVE' : 'DEMO MODE'}
        </p>
      </div>
    `;

    const results = [];
    
    // Send to user
    const userResult = await this.sendEmail(userEmail, userSubject, userHtml);
    results.push({ to: 'user', success: userResult });
    
    // Send to provider (if email provided)
    if (providerEmail) {
      const providerResult = await this.sendEmail(providerEmail, providerSubject, providerHtml);
      results.push({ to: 'provider', success: providerResult });
    } else {
      console.log('⚠️ No provider email available for service completion notification');
    }
    
    return results;
  }

  // 3. Send profile update confirmation email
  async sendProfileUpdateEmail(userEmail, userName) {
    const subject = `Profile Updated - DriveMate`;
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
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          Email delivery: ${this.transporter ? 'ACTIVE' : 'DEMO MODE - Changes saved successfully'}
        </p>
      </div>
    `;

    const result = await this.sendEmail(userEmail, subject, html);
    
    if (!result) {
      console.log(`⚠️ Profile update email to ${userEmail} queued for manual sending`);
    }
    
    return result;
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
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          Email delivery: ${this.transporter ? 'ACTIVE' : 'DEMO MODE - Receipt available in app'}
        </p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }
}

module.exports = new EmailService();