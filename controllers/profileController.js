const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/ServiceRequest");
const Payment = require("../models/Payment");
const { uploadQRToCloudinary, deleteQRFromCloudinary } = require('../config/upload');


// Helper function for status badge classes
function getStatusBadgeClass(status) {
    const statusMap = {
        'pending': 'bg-warning',
        'accepted': 'bg-info',
        'en_route': 'bg-primary',
        'service_started': 'bg-secondary',
        'completed': 'bg-success',
        'cancelled': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
}

// @desc   Show traveller profile
exports.showTravellerProfile = async (req, res) => {
  try {
    const user = req.user;
    
    // Get user statistics
    const serviceRequests = await ServiceRequest.find({ user: user._id })
      .populate('assignedProvider')
      .sort({ createdAt: -1 })
      .limit(10);

    const payments = await Payment.find({ user: user._id })
      .populate('provider', 'businessName')
      .populate('request', 'serviceType')
      .sort({ paidAt: -1 })
      .limit(5);

    // Calculate statistics
    const totalServices = await ServiceRequest.countDocuments({ user: user._id });
    const fuelServices = await ServiceRequest.countDocuments({ 
      user: user._id, 
      serviceType: 'fuel' 
    });
    const mechanicServices = await ServiceRequest.countDocuments({ 
      user: user._id, 
      serviceType: 'mechanic' 
    });
    
    const totalSpent = await Payment.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.render('pages/traveller-profile', {
      user: user,
      serviceRequests: serviceRequests,
      payments: payments,
      statistics: {
        totalServices,
        fuelServices,
        mechanicServices,
        totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0
      },
      getStatusBadgeClass: getStatusBadgeClass // Pass the function to EJS
    });

  } catch (error) {
    console.error("Traveller profile error:", error);
    res.status(500).render('error', { 
      error: "Error loading profile" 
    });
  }
};

// @desc   Show provider profile
exports.showProviderProfile = async (req, res) => {
  try {
    const user = req.user;
    
    const provider = await ServiceProvider.findOne({ user: user._id })
      .populate('user', 'name email phone createdAt');

    if (!provider) {
      return res.redirect('/provider/register');
    }

    // Get provider statistics
    const serviceRequests = await ServiceRequest.find({ 
      assignedProvider: provider._id 
    })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(10);

    const payments = await Payment.find({ provider: provider._id })
      .populate('user', 'name')
      .populate('request', 'serviceType')
      .sort({ paidAt: -1 })
      .limit(10);

    // Calculate statistics
    const totalServices = await ServiceRequest.countDocuments({ 
      assignedProvider: provider._id 
    });
    
    const completedServices = await ServiceRequest.countDocuments({ 
      assignedProvider: provider._id,
      status: 'completed'
    });

    const totalEarnings = await Payment.aggregate([
      { $match: { provider: provider._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.render('pages/provider-profile', {
      user: user,
      provider: provider,
      serviceRequests: serviceRequests,
      payments: payments,
      statistics: {
        totalServices,
        completedServices,
        totalEarnings: totalEarnings.length > 0 ? totalEarnings[0].total : 0,
        completionRate: totalServices > 0 ? Math.round((completedServices / totalServices) * 100) : 0
      },
      getStatusBadgeClass: getStatusBadgeClass // Pass the function to EJS
    });

  } catch (error) {
    console.error("Provider profile error:", error);
    res.status(500).render('error', { 
      error: "Error loading provider profile" 
    });
  }
};

// @desc   Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = req.user;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { name, phone },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "Error updating profile"
    });
  }
};

// @desc   Update provider profile
exports.updateProviderProfile = async (req, res) => {
  try {
    const {
      businessName,
      address,
      phone,
      email,
      services,
      assistanceFee,
      travelFeePerKm,
      operatingHours
    } = req.body;

    const user = req.user;
    const provider = await ServiceProvider.findOne({ user: user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    const updateData = {
      businessName,
      address,
      phone,
      email,
      pricing: {
        assistanceFee: parseFloat(assistanceFee),
        travelFeePerKm: parseFloat(travelFeePerKm)
      }
    };

    if (operatingHours) {
      updateData.operatingHours = operatingHours;
    }

    if (services && Array.isArray(services)) {
      updateData.services = services;
    }

    const updatedProvider = await ServiceProvider.findByIdAndUpdate(
      provider._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Provider profile updated successfully",
      provider: updatedProvider
    });

  } catch (error) {
    console.error("Update provider profile error:", error);
    res.status(500).json({
      success: false,
      error: "Error updating provider profile"
    });
  }
};

// @desc   Update provider QR code
exports.updateProviderQRCode = async (req, res) => {
  try {
    const user = req.user;
    const provider = await ServiceProvider.findOne({ user: user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "QR code image is required"
      });
    }

    // Delete old QR code from Cloudinary if exists
    if (provider.qrCode && provider.qrCode.publicId) {
      await deleteQRFromCloudinary(provider.qrCode.publicId);
    }

    // Upload new QR code to Cloudinary
    const uploadResult = await uploadQRToCloudinary(req.file.buffer, user._id);

    // Update provider with new QR code
    provider.qrCode = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date()
    };

    await provider.save();

    res.json({
      success: true,
      message: "QR code updated successfully",
      qrCode: provider.qrCode
    });

  } catch (error) {
    console.error("Update QR code error:", error);
    res.status(500).json({
      success: false,
      error: "Error updating QR code"
    });
  }
};