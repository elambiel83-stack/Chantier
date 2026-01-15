const express = require('express');
const router = express.Router();
const Transport = require('../models/Transport');

// Get all transports
router.get('/', async (req, res) => {
  try {
    const {
      transporter,
      status,
      order,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Apply filters
    if (transporter) query.transporter = transporter;
    if (status) query.status = status;
    if (order) query.order = order;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transports = await Transport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('order', 'orderNumber totalAmount')
      .populate('transporter', 'name phone company');

    const total = await Transport.countDocuments(query);

    res.json({
      transports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching transports:', error);
    res.status(500).json({ error: 'Failed to fetch transports', details: error.message });
  }
});

// Get single transport
router.get('/:id', async (req, res) => {
  try {
    const transport = await Transport.findById(req.params.id)
      .populate('order')
      .populate('transporter', 'name email phone company rating');

    if (!transport) {
      return res.status(404).json({ error: 'Transport not found' });
    }

    res.json({ transport });
  } catch (error) {
    console.error('Error fetching transport:', error);
    res.status(500).json({ error: 'Failed to fetch transport', details: error.message });
  }
});

// Create new transport
router.post('/', async (req, res) => {
  try {
    const transportData = req.body;

    const transport = new Transport(transportData);
    await transport.save();

    res.status(201).json({
      message: 'Transport created successfully',
      transport
    });
  } catch (error) {
    console.error('Error creating transport:', error);
    res.status(500).json({ error: 'Failed to create transport', details: error.message });
  }
});

// Update transport status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, location, note } = req.body;

    const transport = await Transport.findById(req.params.id);
    if (!transport) {
      return res.status(404).json({ error: 'Transport not found' });
    }

    transport.status = status;

    // Update tracking if location provided
    if (location) {
      transport.tracking.currentLocation = {
        ...location,
        timestamp: new Date()
      };
      transport.tracking.history.push({
        ...location,
        timestamp: new Date(),
        status
      });
    }

    await transport.save();

    res.json({
      message: 'Transport status updated successfully',
      transport
    });
  } catch (error) {
    console.error('Error updating transport status:', error);
    res.status(500).json({ error: 'Failed to update transport status', details: error.message });
  }
});

// Update tracking location
router.post('/:id/tracking', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    const transport = await Transport.findById(req.params.id);
    if (!transport) {
      return res.status(404).json({ error: 'Transport not found' });
    }

    const locationData = {
      latitude,
      longitude,
      address,
      timestamp: new Date()
    };

    transport.tracking.currentLocation = locationData;
    transport.tracking.history.push({
      ...locationData,
      status: transport.status
    });

    await transport.save();

    res.json({
      message: 'Tracking updated successfully',
      transport
    });
  } catch (error) {
    console.error('Error updating tracking:', error);
    res.status(500).json({ error: 'Failed to update tracking', details: error.message });
  }
});

// Add proof of delivery
router.post('/:id/proof-of-delivery', async (req, res) => {
  try {
    const { signature, photos, receivedBy } = req.body;

    const transport = await Transport.findById(req.params.id);
    if (!transport) {
      return res.status(404).json({ error: 'Transport not found' });
    }

    transport.proofOfDelivery = {
      signature,
      photos: photos || [],
      receivedBy,
      timestamp: new Date()
    };

    transport.status = 'delivered';
    transport.delivery.actualDate = new Date();

    await transport.save();

    res.json({
      message: 'Proof of delivery added successfully',
      transport
    });
  } catch (error) {
    console.error('Error adding proof of delivery:', error);
    res.status(500).json({ error: 'Failed to add proof of delivery', details: error.message });
  }
});

module.exports = router;
