const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const smsService = require("../utils/smsService");
const emailService = require("../utils/emailService");
const fetch = require('node-fetch');
const { problemUpload, uploadProblemPhotosToCloudinary, deleteFromCloudinary } = require('../config/upload');

// Simple distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate request ID manually
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `REQ-${timestamp}-${random}`.toUpperCase();
}

// @desc   Find nearest providers using MongoDB geospatial queries
const findNearestProviders = async (longitude, latitude, serviceType, maxDistance = 20000) => {
  try {
    console.log(`🔍 Searching for ${serviceType} providers near [${longitude}, ${latitude}]`);
    const businessType = serviceType === 'fuel' ? 'fuel-station' : 'mechanic';
    const providers = await ServiceProvider.find({
      businessType: businessType,
      isAvailable: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: maxDistance // 20km in meters
        }
      }
    })
      .populate('user', 'name phone')
      .select('+businessPhotos') // ADD THIS LINE to include businessPhotos
      .limit(5);
    
    console.log(`📍 MongoDB geospatial query found ${providers.length} ${serviceType} providers`);

    // Calculate actual distances for display
    const providersWithDistance = providers.map(provider => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        provider.location.coordinates[1],
        provider.location.coordinates[0]
      );
      
      // Include businessPhotos in the returned data
      return { 
        ...provider.toObject(), 
        distance: Math.round(distance * 10) / 10,
        businessPhotos: provider.businessPhotos || [] // Ensure businessPhotos is included
      };
    });

    return providersWithDistance;
  } catch (error) {
    console.error("❌ MongoDB geospatial query error:", error);
    return [];
  }
};

// @desc   Geocode coordinates to address
exports.geocodeAddress = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    console.log(`🌍 Geocoding request: ${latitude}, ${longitude}`);
    // Use OpenStreetMap Nominatim API through backend (no CORS issues)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );
    if (!response.ok) {
      throw new Error('OpenStreetMap service unavailable');
    }

    const data = await response.json();
    console.log('🌍 Geocoding API response:', data);
    if (data && data.display_name) {
      console.log('✅ Geocoding successful:', data.display_name);
      return res.json({
        success: true,
        address: data.display_name,
        coordinates: { latitude, longitude }
      });
    } else {
      throw new Error('No address found for these coordinates');
    }
  } catch (error) {
    console.error('Geocoding API error:', error);
    // Fallback to coordinates
    return res.json({
      success: true,
      address: `Near ${parseFloat(latitude).toFixed(6)}, ${parseFloat(longitude).toFixed(6)}`,
      coordinates: { latitude, longitude },
      note: 'Used fallback address due to geocoding error'
    });
  }
};

// @desc   Create new service request
exports.createServiceRequest = async (req, res) => {
  try {
    console.log("=== CREATE SERVICE REQUEST ===");
    const { serviceType, fuelType, quantity, problemDescription, vehicleType, userAddress, userPhone, latitude, longitude } = req.body;
    const user = req.user;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: "Location is required. Please get your location first."
      });
    }

    // Generate request ID manually
    const requestId = generateRequestId();
    console.log("🆔 Generated Request ID:", requestId);

    // Create service request
    const serviceRequest = new ServiceRequest({
      requestId: requestId,
      user: user._id,
      serviceType,
      fuelType: serviceType === 'fuel' ? fuelType : undefined,
      quantity: serviceType === 'fuel' ? parseInt(quantity) : undefined,
      problemDescription: serviceType === 'mechanic' ? problemDescription : undefined,
      vehicleType: vehicleType || 'car',
      userAddress,
      userPhone: userPhone || user.phone,
      userLocation: {
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    });

    console.log("📝 Service request created with ID:", requestId);

    // Use MongoDB geospatial query to find nearest providers
    const nearbyProviders = await findNearestProviders(
      parseFloat(longitude),
      parseFloat(latitude),
      serviceType
    );

    console.log(`📍 Found ${nearbyProviders.length} nearby providers within 20km`);

    // PRACTICAL LOGIC: Only calculate costs if providers are found
    let costEstimate = null;
    if (nearbyProviders.length > 0) {
      // Calculate cost estimate ONLY when providers are available
      const fuelPrices = {
        petrol: 96.7,
        diesel: 89.6,
        cng: 75.3
      };
      let fuelCost = 0;
      if (serviceType === 'fuel' && quantity) {
        fuelCost = fuelPrices[fuelType] * quantity;
      }
      const assistanceFee = nearbyProviders[0].pricing.assistanceFee;
      const travelFee = Math.round(nearbyProviders[0].pricing.travelFeePerKm * 5);
      const totalCost = Math.round(fuelCost + assistanceFee + travelFee);
      costEstimate = {
        fuelCost: Math.round(fuelCost),
        assistanceFee: assistanceFee,
        travelFee: travelFee,
        totalCost: totalCost
      };
      console.log("💰 Cost estimate calculated:", costEstimate);
    } else {
      console.log("❌ No providers found - skipping cost calculation");
    }

    serviceRequest.costEstimate = costEstimate || {
      fuelCost: 0,
      assistanceFee: 0,
      travelFee: 0,
      totalCost: 0
    };

    // Save the service request
    await serviceRequest.save();
    console.log("✅ Service request saved with ID:", serviceRequest._id);

    // Send SMS confirmation to user
    try {
      await smsService.sendRequestConfirmation(
        userPhone || user.phone,
        requestId,
        serviceType
      );
      console.log('✅ SMS confirmation sent to user');
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
      // Don't fail the request if SMS fails
    }

    res.json({
      success: true,
      request: {
        _id: serviceRequest._id,
        requestId: serviceRequest.requestId,
        serviceType: serviceRequest.serviceType,
        status: serviceRequest.status,
        costEstimate: serviceRequest.costEstimate,
        createdAt: serviceRequest.createdAt
      },
      nearestProviders: nearbyProviders,
      costEstimate: costEstimate
    });

  } catch (error) {
    console.error("❌ Create service request error:", error);
    console.error("Error details:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to create service request: " + error.message
    });
  }
};

// @desc   Get user service requests
exports.getUserRequests = async (req, res) => {
  try {
    console.log("📋 Getting requests for user:", req.user.email);
    const requests = await ServiceRequest.find({ user: req.user._id })
      .populate('assignedProvider')
      .sort({ createdAt: -1 });
    console.log(`✅ Found ${requests.length} requests`);
    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("❌ Get user requests error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get requests"
    });
  }
};

// @desc   Get provider dashboard data
exports.getProviderRequests = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    // Get all pending requests (simplified without geospatial)
    const nearbyRequests = await ServiceRequest.find({
      serviceType: provider.businessType === 'fuel-station' ? 'fuel' : 'mechanic',
      status: 'pending'
    })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get provider's accepted requests
    const myRequests = await ServiceRequest.find({
      assignedProvider: provider._id,
      status: { $in: ['accepted', 'en_route', 'service_started'] }
    })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      provider,
      nearbyRequests,
      myRequests
    });
  } catch (error) {
    console.error("Get provider requests error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get provider data"
    });
  }
};

// @desc   Assign provider to service request
exports.assignProviderToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const provider = await ServiceProvider.findOne({ user: req.user._id });
   
    console.log('🔍 Assign provider called in serviceController:', {
      requestId,
      provider: provider ? provider.businessName : 'Not found',
      userId: req.user._id
    });

    if (!provider) {
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

// @desc   Update request status
exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, currentLat, currentLng } = req.body;
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider profile not found"
      });
    }

    const serviceRequest = await ServiceRequest.findOne({
      requestId: requestId,
      assignedProvider: provider._id
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Request not found or not assigned to you"
      });
    }

    // Validate status progression
    const validStatuses = ['pending', 'accepted', 'en_route', 'service_started', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status"
      });
    }

    // Update status
    serviceRequest.status = status;
    // Add location update if provided
    if (currentLat && currentLng) {
      serviceRequest.providerLocationUpdates.push({
        location: {
          type: 'Point',
          coordinates: [parseFloat(currentLng), parseFloat(currentLat)]
        },
        timestamp: new Date()
      });
    }

    // Set completion time if completed
    if (status === 'completed') {
      serviceRequest.completedAt = new Date();
    }

    await serviceRequest.save();

    console.log(`✅ Request ${requestId} status updated to: ${status}`);

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      request: serviceRequest
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update status"
    });
  }
};

// @desc   Get request details for tracking
exports.getRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;
    console.log(`🔍 Getting details for request ${requestId} by user ${user.email}`);

    const serviceRequest = await ServiceRequest.findOne({ requestId })
      .populate('user', 'name phone')
       .populate('assignedProvider', 'businessName phone address location pricing user qrCode upiId acceptsQRPayments');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Request not found"
      });
    }

    // Allow access to:
    // 1. The user who created the request
    // 2. Any provider (to see nearby requests)
    // 3. The assigned provider
    // 4. Admin users
    const isOwner = serviceRequest.user._id.toString() === user._id.toString();
    const isAssignedProvider = serviceRequest.assignedProvider &&
      serviceRequest.assignedProvider.user.toString() === user._id;
    const isProvider = user.role === 'fuel-station' || user.role === 'mechanic';
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAssignedProvider && !isProvider && !isAdmin) {
      console.log(`❌ Access denied for user ${user.email} to request ${requestId}`);
      return res.status(403).json({
        success: false,
        error: "Access denied - insufficient permissions"
      });
    }

    console.log(`✅ Access granted for user ${user.email} to request ${requestId}`);

    res.json({
      success: true,
      request: serviceRequest
    });
  } catch (error) {
    console.error("Get request details error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get request details"
    });
  }
};

// @desc   Upload problem photos for mechanic service
exports.uploadProblemPhotos = async (req, res) => {
  try {
    const { requestId } = req.params;
    const captions = req.body.captions || [];
    console.log(`📸 Uploading photos for request: ${requestId}`);

    const serviceRequest = await ServiceRequest.findOne({ requestId });
   
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Service request not found"
      });
    }

    // Check if service type is mechanic
    if (serviceRequest.serviceType !== 'mechanic') {
      return res.status(400).json({
        success: false,
        error: "Photos can only be uploaded for mechanic services"
      });
    }

    // Upload to Cloudinary
    const fileBuffers = req.files.map(file => file.buffer);
    const uploadResults = await uploadProblemPhotosToCloudinary(fileBuffers, requestId);

    const photoUrls = uploadResults.map((result, index) => ({
      url: result.url,
      publicId: result.publicId,
      caption: captions[index] || `Problem photo ${index + 1}`,
      uploadedAt: new Date()
    }));

    // Add photos to service request
    serviceRequest.problemPhotos.push(...photoUrls);
    await serviceRequest.save();

    console.log(`✅ ${photoUrls.length} photos uploaded to Cloudinary for request ${requestId}`);

    res.json({
      success: true,
      message: "Photos uploaded successfully",
      photos: photoUrls,
      requestId: requestId
    });

  } catch (error) {
    console.error("❌ Photo upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload photos: " + error.message
    });
  }
};

// @desc   Update problem severity and diagnostic notes
exports.updateProblemDiagnosis = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { problemSeverity, diagnosticNotes } = req.body;
    console.log(`🔧 Updating diagnosis for request: ${requestId}`);

    const serviceRequest = await ServiceRequest.findOne({ requestId });
   
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Service request not found"
      });
    }

    // Update diagnosis fields
    if (problemSeverity) {
      serviceRequest.problemSeverity = problemSeverity;
    }
    if (diagnosticNotes) {
      serviceRequest.diagnosticNotes = diagnosticNotes;
    }

    await serviceRequest.save();

    console.log(`✅ Diagnosis updated for request ${requestId}`);

    res.json({
      success: true,
      message: "Diagnosis updated successfully",
      request: {
        requestId: serviceRequest.requestId,
        problemSeverity: serviceRequest.problemSeverity,
        diagnosticNotes: serviceRequest.diagnosticNotes,
        problemPhotos: serviceRequest.problemPhotos
      }
    });
  } catch (error) {
    console.error("❌ Diagnosis update error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update diagnosis: " + error.message
    });
  }
};

// @desc   Get problem photos for a request
exports.getProblemPhotos = async (req, res) => {
  try {
    const { requestId } = req.params;
    const serviceRequest = await ServiceRequest.findOne({ requestId })
      .select('problemPhotos problemSeverity diagnosticNotes serviceType');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        error: "Service request not found"
      });
    }

    res.json({
      success: true,
      photos: serviceRequest.problemPhotos,
      problemSeverity: serviceRequest.problemSeverity,
      diagnosticNotes: serviceRequest.diagnosticNotes,
      serviceType: serviceRequest.serviceType
    });
  } catch (error) {
    console.error("❌ Get photos error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get photos: " + error.message
    });
  }
};