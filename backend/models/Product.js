const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'cement',
      'concrete',
      'bricks',
      'steel',
      'wood',
      'roofing',
      'plumbing',
      'electrical',
      'paint',
      'tiles',
      'tools',
      'equipment',
      'other'
    ]
  },
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    unit: {
      type: String,
      required: true,
      enum: ['piece', 'kg', 'ton', 'bag', 'm2', 'm3', 'liter', 'set']
    }
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stock: {
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  },
  specifications: {
    brand: String,
    model: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: String
    },
    material: String,
    color: String
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean
  }],
  location: {
    warehouse: String,
    city: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  shipping: {
    available: {
      type: Boolean,
      default: true
    },
    cost: Number,
    freeShippingThreshold: Number
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
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

// Index for searching
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ seller: 1 });

// Update timestamp on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);
