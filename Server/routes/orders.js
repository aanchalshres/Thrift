const express = require("express");
const router = express.Router();
const pool = require("../db");
const notify = require('../utils/notify');
const jwt = require('jsonwebtoken');

function requireUser(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(payload.userId || payload.id) || null;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return null;
    }
    return userId;
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
    return null;
  }
}

router.post("/", async (req, res) => {
  const conn = await pool.getConnection();
  try {
  
    let authUserId = null;
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token && process.env.JWT_SECRET) {
        const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        authUserId = Number(payload.userId || payload.id) || null;
      }
    } catch {}

    const {
      userId = null,
      items = [],
      subtotal = 0,
      tax = 0,
      shipping = 0,
      total = 0,
      paymentMethod = null,
      paymentStatus = "pending",
      shippingAddress = {},
      idempotency_key = null,
    } = req.body;

    if (idempotency_key) {
      try {
        const [existing] = await conn.query(`SELECT id FROM orders WHERE idempotency_key = ? LIMIT 1`, [String(idempotency_key)]);
        if (Array.isArray(existing) && existing[0]) {
        
          conn.release();
          return res.status(200).json({ id: existing[0].id, existing: true });
        }
      } catch (e) {
        console.warn('idempotency lookup failed:', e && e.message ? e.message : e);
      }
    }

    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, subtotal, tax, shipping, total, payment_method, payment_status, shipping_address, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [authUserId != null ? authUserId : (userId || null), subtotal, tax, shipping, total, paymentMethod, paymentStatus, JSON.stringify(shippingAddress), idempotency_key]
    );

    const orderId = orderResult.insertId;

    if (Array.isArray(items) && items.length > 0) {
      const placeholders = [];
      const params = [];
      for (const it of items) {
        const productId = it.productId || null;
        const title = it.title || it.name || "Unknown";
        const price = Number(it.price || 0);
        placeholders.push("(?, ?, ?, ?)");
        params.push(orderId, productId, title, price);
      }
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, title, price) VALUES ${placeholders.join(", ")}`,
        params
      );

      try {
        const productIds = items.map(it => it.productId).filter(Boolean);
        let sellerByProduct = new Map();
        if (productIds.length > 0) {
          const ph = productIds.map(() => '?').join(',');
          const [prodRows] = await conn.query(`SELECT id, user_id FROM products WHERE id IN (${ph})`, productIds);
          for (const r of Array.isArray(prodRows) ? prodRows : []) {
            sellerByProduct.set(Number(r.id), r.user_id || null);
          }
        }
        const salesValues = [];
        const salesParams = [];
        for (const it of items) {
          const pid = it.productId ? Number(it.productId) : null;
          const sellerId = pid ? (sellerByProduct.get(pid) || null) : null;
          if (!sellerId) continue; 
          const title = it.title || it.name || 'Unknown';
          const price = Number(it.price || 0);
          salesValues.push('(?, ?, ?, ?, ?, ?)');
          salesParams.push(sellerId, orderId, authUserId != null ? authUserId : (userId || null), pid, title, price);
        }
        if (salesValues.length > 0) {
          await conn.query(
            `INSERT INTO seller_sales (seller_id, order_id, buyer_id, product_id, title, price) VALUES ${salesValues.join(', ')}`,
            salesParams
          );
        }
      } catch (e) {
        console.warn('seller_sales insert warning:', e && e.message ? e.message : e);
      }

      try {
        const updIds = Array.from(new Set(items.map(it => Number(it.productId)).filter(id => id && !Number.isNaN(id))));
        if (updIds.length > 0) {
          const ph2 = updIds.map(() => '?').join(',');
          await conn.query(
            `UPDATE products SET status = 'order_received' WHERE id IN (${ph2}) AND (status IS NULL OR status = 'unsold')`,
            updIds
          );
        }
      } catch (e) {
        console.warn('product status update warning:', e && e.message ? e.message : e);
      }
    }

    await conn.commit();
    res.status(201).json({ id: orderId });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error("orders POST error:", err);
    res.status(500).json({ message: "Failed to create order", error: err.message });
  } finally {
    conn.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT * FROM orders ORDER BY created_at DESC`
    );
    const orderRows = Array.isArray(orders) ? orders : [];
    if (orderRows.length === 0) return res.json([]);

    const orderIds = orderRows.map(o => o.id);
    const ph = orderIds.map(() => '?').join(',');
    const [items] = await pool.query(
      `SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY id ASC`,
      orderIds
    );
    const itemsByOrder = new Map();
    for (const it of (Array.isArray(items) ? items : [])) {
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
      itemsByOrder.get(it.order_id).push({
        id: it.id,
        product_id: it.product_id,
        title: it.title,
        price: it.price,
        quantity: 1,
      });
    }
    const out = orderRows.map(o => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
    res.json(out);
  } catch (err) {
    console.error("orders GET error:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Get orders placed by the current user (buyer)
router.get('/mine', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const [orders] = await pool.query(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    const orderRows = Array.isArray(orders) ? orders : [];
    if (orderRows.length === 0) return res.json([]);

    const orderIds = orderRows.map(o => o.id);
    const ph = orderIds.map(() => '?').join(',');
    const [items] = await pool.query(
      `SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY id ASC`,
      orderIds
    );
    const itemsByOrder = new Map();
    for (const it of (Array.isArray(items) ? items : [])) {
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
      itemsByOrder.get(it.order_id).push({
        id: it.id,
        product_id: it.product_id,
        title: it.title,
        price: it.price,
        quantity: 1,
      });
    }
    const out = orderRows.map(o => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
    res.json(out);
  } catch (err) {
    console.error('orders MINE error:', err);
    res.status(500).json({ message: 'Failed to fetch my orders' });
  }
});

// Get orders that include items from the current user's products (seller)
router.get('/sold', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    // Find orders that have seller_sales for this seller
    const [orderRows] = await pool.query(
      `SELECT DISTINCT s.order_id,
              o.created_at,
              COALESCE(s.buyer_id, o.user_id) AS buyer_id,
              u.name AS buyer_name
       FROM seller_sales s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN users u ON u.id = COALESCE(s.buyer_id, o.user_id)
       WHERE s.seller_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );
    const orderIds = Array.isArray(orderRows) ? orderRows.map(r => r.order_id) : [];
    if (orderIds.length === 0) return res.json([]);

    const ph = orderIds.map(() => '?').join(',');
    const [itemRows] = await pool.query(
      `SELECT s.order_id, s.product_id, s.title, s.price
       FROM seller_sales s
       WHERE s.seller_id = ? AND s.order_id IN (${ph})`,
      [userId, ...orderIds]
    );

    const itemsByOrder = new Map();
    for (const it of Array.isArray(itemRows) ? itemRows : []) {
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
      itemsByOrder.get(it.order_id).push({
        product_id: it.product_id,
        title: it.title,
        price: it.price,
        quantity: 1,
      });
    }

    const out = (Array.isArray(orderRows) ? orderRows : []).map(o => ({
      id: o.order_id,
      created_at: o.created_at,
      buyer_id: o.buyer_id,
      buyer_name: o.buyer_name || null,
      items: itemsByOrder.get(o.order_id) || [],
    })).filter(o => o.items.length > 0);
    res.json(out);
  } catch (err) {
    console.error('orders SOLD error:', err);
    res.status(500).json({ message: 'Failed to fetch sold orders' });
  }
});

// Update order (partial) - allow buyer to cancel their order and notify sellers
router.put('/:id', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid order id' });

  const { status, payment_status } = req.body || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`SELECT * FROM orders WHERE id = ?`, [id]);
    const order = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow buyer to cancel their own order via this endpoint for now
    if (status && String(status) === 'cancelled') {
      if (Number(order.user_id) !== Number(userId)) {
        await conn.rollback();
        return res.status(403).json({ message: 'Not authorized to cancel this order' });
      }

      // audit status change
      await conn.query(`UPDATE orders SET status = ? WHERE id = ?`, [String(status), id]);
      try {
        await conn.query('INSERT INTO order_audit_log (order_id, actor_id, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [id, userId, 'status', order.status || null, 'cancelled']);
      } catch {}

      // Revert product statuses for items in this order back to 'unsold' if they were set to 'order_received'
      try {
        const [items] = await conn.query(`SELECT product_id FROM order_items WHERE order_id = ?`, [id]);
        const prodIds = (Array.isArray(items) ? items.map(r => Number(r.product_id)).filter(Boolean) : []);
        if (prodIds.length > 0) {
          const ph = prodIds.map(() => '?').join(',');
          await conn.query(
            `UPDATE products SET status = 'unsold' WHERE id IN (${ph}) AND status = 'order_received'`,
            prodIds
          );
        }
      } catch (e) {
        console.warn('failed to revert product statuses on cancel:', e && e.message ? e.message : e);
      }


    }

    // Allow updating payment_status by buyer only as a simple patch (rare)
    if (payment_status) {
      if (Number(order.user_id) !== Number(userId)) {
        // For now, prevent others from changing payment status
      } else {
        const old = order.payment_status || null;
        await conn.query(`UPDATE orders SET payment_status = ? WHERE id = ?`, [String(payment_status), id]);
        try {
          await conn.query('INSERT INTO order_audit_log (order_id, actor_id, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)', [id, userId, 'payment_status', old, String(payment_status)]);
        } catch {}
      }
    }

    await conn.commit();

    // Return fresh order with items
    const [fresh] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [id]);
    const orderRow = Array.isArray(fresh) && fresh.length > 0 ? fresh[0] : null;
    const [orderItems] = await pool.query(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
    const itemsOut = (Array.isArray(orderItems) ? orderItems : []).map(it => ({
      id: it.id,
      product_id: it.product_id,
      title: it.title,
      price: it.price,
      quantity: 1,
    }));
    res.json({ ...orderRow, items: itemsOut });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('orders PUT error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to update order' });
  } finally {
    conn.release();
  }
});

module.exports = router;
