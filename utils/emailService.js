const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({ // FIXED: createTransport (not createTransporter)
      // Configure with your email service (Gmail, SendGrid, etc.)
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Send email (works in demo mode without actual email config)
  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@roadside.com',
        to: to,
        subject: subject,
        html: html
      };

      if (process.env.NODE_ENV === 'production' && process.env.EMAIL_USER) {
        await this.transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to: ${to}`);
      } else {
        // Demo mode - log the email content
        console.log('DEMO EMAIL:', { to, subject, html });
      }
      
      return true;
    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  }

  // Send payment receipt
  async sendPaymentReceipt(userEmail, userName, paymentDetails) {
    const subject = `Payment Receipt - Roadside Assistance #${paymentDetails.requestId}`;
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
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${paymentDetails.transactionId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Date:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
        
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>Roadside Assistance Team</p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }

  // Send service completion notification
  async sendServiceCompletion(userEmail, userName, serviceDetails) {
    const subject = `Service Completed - Roadside Assistance #${serviceDetails.requestId}`;
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
        
        <p>Please log in to your account to make the payment and rate your service experience.</p>
        
        <p>Thank you for choosing Roadside Assistance!</p>
        <p>Best regards,<br>Roadside Assistance Team</p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }
}

module.exports = new EmailService();