const mongoose = require("mongoose");

// OVERWRITE PROTECTION: Check if model already exists
if (mongoose.models.ServiceProvider) {
  module.exports = mongoose.models.ServiceProvider;
} else {
  const serviceProviderSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    businessName: {
      type: String,
      required: true,
      trim: true
    },
    businessType: {
      type: String,
      enum: ['fuel-station', 'mechanic'],
      required: true
    },
    services: [{
      type: String
    }],
    address: {
      type: String,
      required: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      }
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    
    // ADD BUSINESS PHOTOS FIELD HERE
    businessPhotos: [{
      url: {
        type: String,
        required: true
      },
      publicId: {
        type: String,
        required: true
      },
      caption: {
        type: String,
        default: ''
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // PAYMENT FIELDS
    upiId: {
      type: String,
      trim: true
    },
    qrCode: {
      url: String,
      publicId: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    acceptsQRPayments: {
      type: Boolean,
      default: false
    },
    // END ADDED PAYMENT FIELDS
    isVerified: {
      type: Boolean,
      default: false
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    pricing: {
      assistanceFee: {
        type: Number,
        default: 100
      },
      travelFeePerKm: {
        type: Number,
        default: 10
      },
      fuelPrices: {
        petrol: { type: Number, default: 0 },
        diesel: { type: Number, default: 0 },
        cng: { type: Number, default: 0 }
      }
    },
    rating: {
      type: Number,
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    operatingHours: {
      open: String,
      close: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });

  // Create geospatial index
  serviceProviderSchema.index({ location: '2dsphere' });

  module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
}