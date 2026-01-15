const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    unit: String,
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  totalAmount: {
    subtotal: {
      type: Number,
      required: true
    },
    shipping: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  shippingAddress: {
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'in_transit',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  payment: {
    method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash_on_delivery', 'mobile_money'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date
  },
  transport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transport'
  },
  notes: String,
  timeline: [{
    status: String,
    timestamp: Date,
    note: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate order number before saving
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.orderNumber = `ORD-${timestamp}-${random}`.toUpperCase();
  }
  this.updatedAt = Date.now();
  next();
});

// Index for queries
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'items.seller': 1 });

module.exports = mongoose.model('Order', orderSchema);
