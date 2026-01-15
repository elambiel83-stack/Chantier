const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Get all orders (with filters)
router.get('/', async (req, res) => {
  try {
    const {
      buyer,
      seller,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Apply filters
    if (buyer) query.buyer = buyer;
    if (status) query.status = status;
    if (seller) query['items.seller'] = seller;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('buyer', 'name email phone')
      .populate('items.product', 'name category')
      .populate('items.seller', 'name company');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name email phone address')
      .populate('items.product')
      .populate('items.seller', 'name email phone company')
      .populate('transport');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    const orderData = req.body;

    const order = new Order(orderData);
    await order.save();

    // Add to timeline
    order.timeline.push({
      status: 'pending',
      timestamp: new Date(),
      note: 'Order created'
    });
    await order.save();

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date(),
      note: note || `Order status changed to ${status}`
    });

    await order.save();

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// Cancel order
router.post('/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: req.body.reason || 'Order cancelled by user'
    });

    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order', details: error.message });
  }
});

module.exports = router;
