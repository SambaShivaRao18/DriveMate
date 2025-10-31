const ServiceRequest = require("../models/ServiceRequest");
const Payment = require("../models/Payment");
const ServiceProvider = require("../models/ServiceProvider");
const emailService = require("../utils/emailService");
const User = require("../models/User"); // Added to get provider email

// @desc   Process payment for service request
exports.processPayment = async (req, res) => {
  try {
    const { requestId, paymentMethod, amount, transactionId } = req.body;
    const user = req.user;
    console.log(`💰 Processing payment for request ${requestId} by user ${user.email}`);
    
    const serviceRequest = await ServiceRequest.findOne({ requestId })
      .populate('user', 'name email')
      .populate('assignedProvider', 'businessName user phone email');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Service request not found"
      });
    }

    // Check if user owns the request
    if (serviceRequest.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to pay for this request"
      });
    }

    // Check if request is completed
    if (serviceRequest.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: "Service must be completed before payment"
      });
    }

    // Check if already paid
    const existingPayment = await Payment.findOne({ request: serviceRequest._id });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: "Payment already processed for this request"
      });
    }

    // Create payment record
    const payment = new Payment({
      request: serviceRequest._id,
      user: serviceRequest.user._id,
      provider: serviceRequest.assignedProvider._id,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod,
      transactionId: paymentMethod !== 'cash' ? transactionId : `CASH-${requestId}`,
      status: 'completed'
    });

    await payment.save();

    // Update service request with actual cost and payment status
    serviceRequest.actualCost = parseFloat(amount);
    serviceRequest.paymentStatus = 'paid';
    await serviceRequest.save();

    // ✅ MOVED EMAIL SENDING CODE HERE
    try {
      // Send email receipt
      await emailService.sendPaymentReceipt(
        serviceRequest.user.email,
        serviceRequest.user.name,
        {
          requestId: serviceRequest.requestId,
          serviceType: serviceRequest.serviceType,
          amount: amount,
          paymentMethod: paymentMethod,
          transactionId: payment.transactionId
        }
      );
      console.log('✅ Payment receipt email sent');
    } catch (emailError) {
      console.error('Payment receipt email failed:', emailError);
    }

    // ✅ SEND SERVICE COMPLETION EMAIL TO BOTH USER AND PROVIDER
    try {
      const provider = serviceRequest.assignedProvider;
      if (provider) {
        // Get provider's user details for email
        const providerUser = await User.findById(provider.user);
        
        const emailResults = await emailService.sendServiceCompletionEmail(
          serviceRequest.user.email,        // User email
          serviceRequest.user.name,         // User name
          provider.email || providerUser?.email, // Provider email
          provider.businessName,            // Provider business name
          requestId,                        // Request ID
          amount,                           // Amount
          serviceRequest.serviceType        // Service type
        );
        
        // Log email results
        emailResults.forEach(result => {
          if (result.success) {
            console.log(`✅ ${result.to} completion email sent`);
          } else {
            console.log(`⚠️ ${result.to} completion email failed`);
          }
        });
      }
    } catch (emailError) {
      console.error('Completion email failed:', emailError);
    }

    console.log(`✅ Payment processed for request ${requestId}: ₹${amount}`);

    res.json({
      success: true,
      message: "Payment processed successfully",
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.paymentMethod,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt
      }
    });

  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      success: false,
      error: "Payment processing failed: " + error.message
    });
  }
};

// @desc   Get payment history for user
exports.getPaymentHistory = async (req, res) => {
  try {
    const user = req.user;
    console.log(`📋 Getting payment history for user ${user.email}`);
    const payments = await Payment.find({ user: user._id })
      .populate('request', 'requestId serviceType')
      .populate('provider', 'businessName')
      .sort({ paidAt: -1 });

    console.log(`✅ Found ${payments.length} payments for user ${user.email}`);

    res.json({
      success: true,
      payments
    });

  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get payment history"
    });
  }
};

// @desc   Get provider earnings
exports.getProviderEarnings = async (req, res) => {
  try {
    const user = req.user;
    console.log(`💰 Getting earnings for provider ${user.email}`);
    const provider = await ServiceProvider.findOne({ user: user._id });
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    const payments = await Payment.find({ provider: provider._id })
      .populate('request', 'requestId serviceType createdAt')
      .populate('user', 'name phone')
      .sort({ paidAt: -1 });

    // Calculate total earnings
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

    console.log(`✅ Provider ${provider.businessName} earnings: ₹${totalEarnings} from ${payments.length} payments`);

    res.json({
      success: true,
      earnings: {
        total: totalEarnings,
        payments: payments,
        paymentCount: payments.length
      }
    });

  } catch (error) {
    console.error("Get provider earnings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get earnings data"
    });
  }
};

// @desc   Submit rating and review
exports.submitRating = async (req, res) => {
  try {
    const { requestId, rating, review } = req.body;
    const user = req.user;
    console.log(`⭐ Submitting rating for request ${requestId} by user ${user.email}`);

    const serviceRequest = await ServiceRequest.findOne({ requestId })
      .populate('assignedProvider');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Service request not found"
      });
    }

    // Check if user owns the request
    if (serviceRequest.user.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to rate this request"
      });
    }

    // Check if request is completed and paid
    if (serviceRequest.status !== 'completed' || serviceRequest.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        error: "Can only rate completed and paid services"
      });
    }

    // Check if already rated
    if (serviceRequest.rating) {
      return res.status(400).json({
        success: false,
        error: "You have already rated this service"
      });
    }

    // Update service request with rating
    serviceRequest.rating = parseInt(rating);
    serviceRequest.review = review;
    await serviceRequest.save();

    // Update provider's overall rating
    const provider = serviceRequest.assignedProvider;
    const providerRequests = await ServiceRequest.find({
      assignedProvider: provider._id,
      rating: { $exists: true, $gte: 1 }
    });

    if (providerRequests.length > 0) {
      const totalRatings = providerRequests.length;
      const averageRating = providerRequests.reduce((sum, req) => sum + req.rating, 0) / totalRatings;
      provider.rating = parseFloat(averageRating.toFixed(1));
      provider.totalRatings = totalRatings;
      await provider.save();
    }

    console.log(`✅ Rating submitted for request ${requestId}: ${rating} stars`);

    res.json({
      success: true,
      message: "Thank you for your rating!",
      rating: serviceRequest.rating,
      review: serviceRequest.review
    });

  } catch (error) {
    console.error("Submit rating error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit rating"
    });
  }
};