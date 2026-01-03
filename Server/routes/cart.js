const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Get user's cart
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        c.id as cart_item_id,
        p.id as id,
        c.quantity,
        p.title,
        p.price,
        p.image,
        p.status
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/add', authenticate, async (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  const quantity = parseInt(req.body.quantity || 1, 10);
  
  if (!productId || isNaN(productId)) {
    return res.status(400).json({ error: 'Valid product ID is required' });
  }

  try {
    // Check if product exists and is available
    const [products] = await pool.query(
      'SELECT id, title, price, image, status FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];

    if (product.status && product.status !== 'unsold') {
      return res.status(400).json({ error: `Product is ${product.status}` });
    }

    // Check if already in cart
    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    if (existing.length > 0) {
      // Update quantity
      return res.json({ message: 'Cart updated', product });
    }

    // Insert new cart item
    await pool.query(
      'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [req.user.userId, productId, quantity]
    );

    res.json({ message: 'Item added to cart', product });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update cart item quantity
router.put('/:productId', authenticate, async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
      [quantity, req.user.userId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.json({ message: 'Cart updated' });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
router.delete('/:productId', authenticate, async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  const userId = req.user.userId;

  console.log(`[CART DELETE] User ${userId} removing product ${productId} (type: ${typeof productId})`);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    console.log(`[CART DELETE] Rows affected: ${result.affectedRows}`);

    if (result.affectedRows === 0) {
      console.log(`[CART DELETE] No cart item found for user ${userId}, product ${productId}`);
      return res.status(404).json({ error: 'Cart item not found' });
    }

    console.log(`[CART DELETE] Successfully removed item`);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('[CART DELETE] Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear entire cart
router.delete('/', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.userId]);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
