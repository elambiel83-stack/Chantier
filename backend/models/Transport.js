const mongoose = require('mongoose');

const transportSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['standard', 'express', 'heavy_load', 'special'],
    default: 'standard'
  },
  vehicle: {
    type: String,
    plateNumber: String,
    capacity: Number,
    unit: String
  },
  driver: {
    name: String,
    phone: String,
    licenseNumber: String
  },
  pickup: {
    location: {
      street: String,
      city: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    scheduledDate: Date,
    actualDate: Date,
    contactPerson: String,
    contactPhone: String
  },
  delivery: {
    location: {
      street: String,
      city: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    scheduledDate: Date,
    actualDate: Date,
    contactPerson: String,
    contactPhone: String
  },
  status: {
    type: String,
    enum: [
      'pending',
      'assigned',
      'pickup_scheduled',
      'picked_up',
      'in_transit',
      'delivery_scheduled',
      'delivered',
      'failed',
      'cancelled'
    ],
    default: 'pending'
  },
  tracking: {
    currentLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
      timestamp: Date
    },
    history: [{
      latitude: Number,
      longitude: Number,
      address: String,
      timestamp: Date,
      status: String
    }]
  },
  cost: {
    amount: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  distance: {
    value: Number,
    unit: {
      type: String,
      default: 'km'
    }
  },
  estimatedDuration: {
    value: Number,
    unit: {
      type: String,
      default: 'hours'
    }
  },
  notes: String,
  proofOfDelivery: {
    signature: String,
    photos: [String],
    receivedBy: String,
    timestamp: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
transportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for queries
transportSchema.index({ order: 1 });
transportSchema.index({ transporter: 1, status: 1 });
transportSchema.index({ status: 1 });

module.exports = mongoose.model('Transport', transportSchema);
