
const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceType: {
    type: String,
    enum: ['fuel', 'mechanic'],
    required: true
  },
  problemDescription: {
    type: String,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['car', 'bike', 'scooter', 'truck', 'other'],
    default: 'car'
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'cng'],
    required: function() { return this.serviceType === 'fuel'; }
  },
  quantity: {
    type: Number,
    required: function() { return this.serviceType === 'fuel'; }
  },
  userLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number] // [longitude, latitude]
    }
  },
  userAddress: {
    type: String,
    required: true
  },
  assignedProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'en_route', 'service_started', 'completed', 'cancelled'],
    default: 'pending'
  },
  costEstimate: {
    fuelCost: { type: Number, default: 0 },
    assistanceFee: { type: Number, default: 0 },
    travelFee: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  },
  actualCost: {
    type: Number
  },
  providerLocationUpdates: [{
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number]
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  userPhone: {
    type: String,
    required: true
  },
  providerPhone: {
    type: String
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
});

// FIXED: Generate unique request ID before saving
serviceRequestSchema.pre('save', function(next) {
  if (this.isNew && !this.requestId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.requestId = `REQ-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);