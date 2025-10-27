const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/ServiceRequest");
const smsService = require("../utils/smsService");
const fetch = require('node-fetch');
const { qrUpload, uploadQRToCloudinary, uploadBusinessPhotosToCloudinary, deleteFromCloudinary } = require('../config/upload');

// Reverse geocode coordinates to address
async function reverseGeocode(latitude, longitude) {
    try {
        console.log(`📍 Reverse geocoding: ${latitude}, ${longitude}`);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );

        if (!response.ok) {
            throw new Error('Reverse geocoding service unavailable');
        }

        const data = await response.json();
        if (data && data.display_name) {
            console.log('✅ Reverse geocoding successful:', data.display_name);
            return data.display_name;
        } else {
            throw new Error('Could not determine address from coordinates');
        }
    } catch (error) {
        console.error('❌ Reverse geocoding error:', error);
        // Fallback: return coordinates-based address
        return `Near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
}

// @desc   Show provider registration page
exports.showProviderRegister = async (req, res) => {
    try {
        // Check if provider already registered
        const existingProvider = await ServiceProvider.findOne({ user: req.user._id });
        if (existingProvider) {
            // If already registered, redirect to dashboard
            return res.redirect('/provider/dashboard');
        }

        res.render('pages/provider-register', {
            user: req.user,
            error: null
        });
    } catch (error) {
        console.error('Provider register page error:', error);
        res.status(500).render('error', { error: 'Failed to load registration page' });
    }
};

// @desc   Register service provider
exports.registerProvider = async (req, res) => {
  try {
    const {
      businessName,
      address,
      phone,
      email,
      services,
      assistanceFee,
      travelFeePerKm,
      petrolPrice,
      dieselPrice,
      cngPrice,
      latitude,
      longitude,
      paymentMethods,
      upiId
    } = req.body;
    const user = req.user;
    
    // Check if provider already registered
    const existingProvider = await ServiceProvider.findOne({ user: user._id });
    if (existingProvider) {
      return res.status(400).render('pages/provider-register', {
        user: req.user,
        error: "You are already registered as a service provider"
      });
    }

    // VALIDATE COORDINATES
    if (!latitude || !longitude) {
      return res.status(400).render('pages/provider-register', {
        user: req.user,
        error: "Latitude and longitude are required"
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    // Validate coordinate ranges (Hyderabad area roughly)
    if (lat < 17.3 || lat > 17.6 || lng < 78.3 || lng > 78.5) {
      return res.status(400).render('pages/provider-register', {
        user: req.user,
        error: "Coordinates appear to be outside Hyderabad area. Please check and try again."
      });
    }

    // Get accurate address from coordinates
    let businessAddress = address;
    if (!businessAddress || businessAddress.trim() === '') {
      businessAddress = await reverseGeocode(lat, lng);
    }

    // Process payment methods
    const paymentMethodsArray = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
    const acceptsQRPayments = paymentMethodsArray.includes('qr');

    // Validate QR payment requirements
    if (acceptsQRPayments) {
      if (!upiId) {
        return res.status(400).render('pages/provider-register', {
          user: req.user,
          error: "UPI ID is required when QR payments are enabled"
        });
      }
      if (!req.file) {
        return res.status(400).render('pages/provider-register', {
          user: req.user,
          error: "QR code image is required when QR payments are enabled"
        });
      }
    }

    const providerData = {
      user: user._id,
      businessName,
      businessType: user.role,
      address: businessAddress,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      phone,
      email,
      pricing: {
        assistanceFee: parseFloat(assistanceFee),
        travelFeePerKm: parseFloat(travelFeePerKm)
      },
      acceptsQRPayments: acceptsQRPayments,
      upiId: upiId || undefined,
      isVerified: true,
      isAvailable: true
    };

    // Handle QR code upload if provided
    if (req.file && acceptsQRPayments) {
      try {
        const uploadResult = await uploadQRToCloudinary(req.file.buffer, user._id);
        providerData.qrCode = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date()
        };
        console.log('✅ QR code uploaded to Cloudinary:', uploadResult.secure_url);
      } catch (uploadError) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        return res.status(400).render('pages/provider-register', {
          user: req.user,
          error: "QR code upload failed. Please try again."
        });
      }
    }

    // Handle business photos upload if provided
    if (req.files && req.files.businessPhotos && req.files.businessPhotos.length > 0) {
      try {
        const fileBuffers = req.files.businessPhotos.map(file => file.buffer);
        const uploadResults = await uploadBusinessPhotosToCloudinary(fileBuffers, user._id);
        providerData.businessPhotos = uploadResults;
        console.log(`✅ ${uploadResults.length} business photos uploaded to Cloudinary`);
      } catch (uploadError) {
        console.error('❌ Business photos upload failed:', uploadError);
        // Don't fail registration if business photos fail
      }
    }

    // Add service-specific data
    if (user.role === 'mechanic') {
      providerData.services = Array.isArray(services) ? services : [services];
    } else if (user.role === 'fuel-station') {
      providerData.pricing.fuelPrices = {
        petrol: parseFloat(petrolPrice) || 0,
        diesel: parseFloat(dieselPrice) || 0,
        cng: parseFloat(cngPrice) || 0
      };
    }

    const provider = new ServiceProvider(providerData);
    await provider.save();

    console.log(`✅ Provider registered: ${businessName} at ${businessAddress}`);
    if (acceptsQRPayments) {
      console.log(`📱 QR payments enabled with UPI: ${upiId}`);
    }

    res.redirect('/provider/dashboard');
  } catch (error) {
    console.error('Provider registration error:', error);
    res.status(500).render('pages/provider-register', {
      user: req.user,
      error: "Registration failed: " + error.message
    });
  }
};

// @desc   Show provider dashboard
exports.showProviderDashboard = async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id })
            .populate('user', 'name email phone');
           
        if (!provider) {
            // If provider not registered yet, redirect to registration
            return res.redirect('/provider/register');
        }

        // Get nearby requests for this provider
        const nearbyRequests = await ServiceRequest.find({
            serviceType: provider.businessType === 'fuel-station' ? 'fuel' : 'mechanic',
            status: 'pending'
        })
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .limit(10);

        res.render('pages/provider-dashboard', {
            user: req.user,
            provider: provider,
            nearbyRequests: nearbyRequests
        });
    } catch (error) {
        console.error('Provider dashboard error:', error);
        res.status(500).render('error', { error: 'Failed to load dashboard' });
    }
};

// @desc   Get provider profile (API endpoint - keep for frontend)
exports.getProviderProfile = async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id });
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: "Provider profile not found"
            });
        }

        res.json({
            success: true,
            provider
        });
    } catch (error) {
        console.error("Get provider profile error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get provider profile"
        });
    }
};

// @desc   Toggle provider availability
exports.toggleAvailability = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    provider.isAvailable = !provider.isAvailable;
    await provider.save();

    res.json({
      success: true,
      message: `You are now ${provider.isAvailable ? 'available' : 'unavailable'} for requests`,
      isAvailable: provider.isAvailable
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to update availability"
    });
  }
};

// @desc   Get provider's active requests
exports.getProviderActiveRequests = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    const activeRequests = await ServiceRequest.find({
      assignedProvider: provider._id,
      status: { $in: ['accepted', 'en_route', 'service_started'] }
    })
    .populate('user', 'name phone')
    .sort({ acceptedAt: -1 });

    console.log(`✅ Found ${activeRequests.length} active requests for provider ${provider.businessName}`);

    res.json({
      success: true,
      activeRequests
    });
  } catch (error) {
    console.error('Get active requests error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to get active requests"
    });
  }
};

// @desc   Update provider location (for real-time tracking)
exports.updateProviderLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    // Update provider location
    provider.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
    await provider.save();

    console.log(`📍 Provider ${provider.businessName} location updated: ${latitude}, ${longitude}`);

    res.json({
      success: true,
      message: "Location updated successfully"
    });
  } catch (error) {
    console.error('Update provider location error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to update location"
    });
  }
};

// @desc   Assign provider to service request - ENHANCED WITH DEBUG LOGGING
exports.assignProviderToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const provider = await ServiceProvider.findOne({ user: req.user._id });
   
    console.log('🔍 Assign provider called:', {
      requestId,
      provider: provider ? provider.businessName : 'Not found',
      userId: req.user._id
    });

    if (!provider) {
      console.log('❌ Provider not found for user:', req.user._id);
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    const serviceRequest = await ServiceRequest.findOne({
      requestId: requestId,
      status: 'pending'
    });

    console.log('🔍 Service request found:', serviceRequest ? serviceRequest.requestId : 'Not found');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Request not found or already assigned"
      });
    }

    // Check if provider is available
    if (!provider.isAvailable) {
      return res.status(400).json({
        success: false,
        error: "Please set your status to available to accept requests"
      });
    }

    // Assign provider to request
    serviceRequest.assignedProvider = provider._id;
    serviceRequest.status = 'accepted';
    serviceRequest.acceptedAt = new Date();
    serviceRequest.providerPhone = provider.phone;
    await serviceRequest.save();

    // ✅ MOVED SMS SENDING CODE HERE
    try {
      // Send SMS to user about provider assignment
      const userPhone = serviceRequest.userPhone;
      const providerName = provider.businessName;
      const providerPhone = provider.phone;
      await smsService.sendProviderAssigned(
        userPhone,
        providerName,
        providerPhone,
        '10-15' // Estimated ETA
      );
      console.log('✅ Provider assignment SMS sent to user');
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
    }

    console.log(`✅ Request ${requestId} assigned to provider: ${provider.businessName}`);

    res.json({
      success: true,
      message: "Request accepted successfully",
      request: serviceRequest
    });
  } catch (error) {
    console.error("❌ Assign provider error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to accept request: " + error.message
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
      await deleteFromCloudinary(provider.qrCode.publicId);
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

// @desc   Show provider edit profile page
exports.showEditProfile = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.redirect('/provider/register');
    }

    res.render('pages/provider-edit-profile', {
      user: req.user,
      provider: provider,
      error: null
    });
  } catch (error) {
    console.error('Edit profile page error:', error);
    res.status(500).render('error', { error: 'Failed to load edit profile page' });
  }
};

// @desc   Update provider profile
// @desc   Update provider profile
// @desc   Update provider profile
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
      operatingHoursOpen,
      operatingHoursClose,
      upiId
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
      },
      upiId: upiId || provider.upiId
    };

    // Handle operating hours
    if (operatingHoursOpen || operatingHoursClose) {
      updateData.operatingHours = {
        open: operatingHoursOpen,
        close: operatingHoursClose
      };
    }

    // Handle services
    if (services) {
      if (typeof services === 'string') {
        updateData.services = [services];
      } else if (Array.isArray(services)) {
        updateData.services = services;
      }
    }

    // FIX: Handle files from .any() - they come in req.files array
    console.log('🔍 Files received:', req.files ? req.files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname })) : 'No files');

    // Process QR code file
    const qrCodeFile = req.files ? req.files.find(file => file.fieldname === 'qrCode') : null;
    if (qrCodeFile) {
      try {
        // Delete old QR code from Cloudinary if exists
        if (provider.qrCode && provider.qrCode.publicId) {
          await deleteFromCloudinary(provider.qrCode.publicId);
        }

        // Upload new QR code to Cloudinary
        const uploadResult = await uploadQRToCloudinary(qrCodeFile.buffer, user._id);
        updateData.qrCode = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date()
        };
        console.log('✅ QR code updated successfully');
      } catch (uploadError) {
        console.error('❌ QR code update failed:', uploadError);
        return res.status(400).json({
          success: false,
          error: "QR code update failed. Please try again."
        });
      }
    }

    // Process business photos files
    const businessPhotoFiles = req.files ? req.files.filter(file => file.fieldname === 'businessPhotos') : [];
    if (businessPhotoFiles.length > 0) {
      try {
        const fileBuffers = businessPhotoFiles.map(file => file.buffer);
        const uploadResults = await uploadBusinessPhotosToCloudinary(fileBuffers, user._id);
        
        // Add new photos to existing ones (limit to 3 total)
        const existingPhotos = provider.businessPhotos || [];
        const allPhotos = [...existingPhotos, ...uploadResults].slice(0, 3);
        updateData.businessPhotos = allPhotos;
        
        console.log(`✅ ${uploadResults.length} business photos uploaded`);
      } catch (uploadError) {
        console.error('❌ Business photos upload failed:', uploadError);
        // Don't fail the update if photos fail
      }
    }

    const updatedProvider = await ServiceProvider.findByIdAndUpdate(
      provider._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      provider: updatedProvider
    });

  } catch (error) {
    console.error("Update provider profile error:", error);
    res.status(500).json({
      success: false,
      error: "Error updating provider profile: " + error.message
    });
  }
};

// @desc   Delete business photo
exports.deleteBusinessPhoto = async (req, res) => {
  try {
    const { photoIndex } = req.params;
    const user = req.user;

    const provider = await ServiceProvider.findOne({ user: user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    if (!provider.businessPhotos || provider.businessPhotos.length <= photoIndex) {
      return res.status(400).json({
        success: false,
        error: "Photo not found"
      });
    }

    const photoToDelete = provider.businessPhotos[photoIndex];
    
    // Delete from Cloudinary
    if (photoToDelete.publicId) {
      await deleteFromCloudinary(photoToDelete.publicId);
    }

    // Remove from array
    provider.businessPhotos.splice(photoIndex, 1);
    await provider.save();

    res.json({
      success: true,
      message: "Business photo deleted successfully"
    });

  } catch (error) {
    console.error("Delete business photo error:", error);
    res.status(500).json({
      success: false,
      error: "Error deleting business photo"
    });
  }
};