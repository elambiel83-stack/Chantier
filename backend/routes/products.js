const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get all products (with filters)
router.get('/', async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      seller,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (category) query.category = category;
    if (seller) query.seller = seller;
    if (search) {
      query.$text = { $search: search };
    }
    if (minPrice || maxPrice) {
      query['price.amount'] = {};
      if (minPrice) query['price.amount'].$gte = parseFloat(minPrice);
      if (maxPrice) query['price.amount'].$lte = parseFloat(maxPrice);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('seller', 'name company rating');

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name email phone company rating');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Increment views
    product.views += 1;
    await product.save();

    res.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

// Create new product (seller only)
router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    
    // In a real app, get seller from authenticated user
    // const sellerId = req.user.id;
    
    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// Delete product (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
});

// Get product categories
router.get('/meta/categories', (req, res) => {
  const categories = [
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
  ];
  res.json({ categories });
});

module.exports = router;
