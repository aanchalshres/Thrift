const express = require('express');
const router = express.Router();
require('dotenv').config();
const { getEsewaEndpoint, signEsewa, buildEsewaConfig } = require('../utils/esewa');
const pool = require('../db');

function resolveServerBase() {
  const explicit = process.env.SERVER_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN; // Railway deployment
  return `http://localhost:${process.env.PORT || 5000}`;
}

function resolveClientBase() {
  const explicit = process.env.CLIENT_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'http://localhost:8080'; // Vite dev fallback
}

// Initiate eSewa payment
router.post('/esewa/initiate', async (req, res) => {
  try {
    const { amount, productName, transactionId, orderId } = req.body || {};
    if (!amount || !productName) {
      return res.status(400).json({ message: 'Missing amount or productName' });
    }
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const productCode = process.env.ESEWA_MERCHANT_CODE;
    const secretKey = process.env.ESEWA_SECRET_KEY;
    if (!productCode || !secretKey) {
      return res.status(500).json({ message: 'Missing ESEWA_MERCHANT_CODE or ESEWA_SECRET_KEY in environment' });
    }

    const clientBase = resolveClientBase();
    const serverBase = resolveServerBase();
    const env = (process.env.ESEWA_ENV || 'sandbox').toLowerCase();
    const endpoint = getEsewaEndpoint(env);

    const transactionUuid = orderId
      ? `order-${Number(orderId)}-${Date.now()}`
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (orderId) {
      try {
        await pool.query('UPDATE orders SET esewa_transaction_uuid = ?, payment_method = ?, payment_status = ? WHERE id = ?', [
          transactionUuid,
          'esewa',
          'pending',
          Number(orderId),
        ]);
      } catch (e) {
        console.warn('Failed to map order to eSewa UUID:', e && e.message ? e.message : e);
      }
    }

    const esewaConfig = buildEsewaConfig({
      amount: amt,
      productCode,
      // Route via server so we can accept POST, verify, update order, then redirect to client
      successUrl: `${serverBase}/api/payments/esewa/success`,
      failureUrl: `${serverBase}/api/payments/esewa/failure`,
      transactionUuid,
    });

    const signatureString = `total_amount=${esewaConfig.total_amount},transaction_uuid=${esewaConfig.transaction_uuid},product_code=${esewaConfig.product_code}`;
    const signature = signEsewa(secretKey, signatureString);

    return res.json({
      endpoint,
      esewaConfig: {
        ...esewaConfig,
        signature,
        product_service_charge: Number(esewaConfig.product_service_charge),
        product_delivery_charge: Number(esewaConfig.product_delivery_charge),
        tax_amount: Number(esewaConfig.tax_amount),
        total_amount: Number(esewaConfig.total_amount),
      },
    });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to initiate eSewa payment', error: e && e.message ? e.message : String(e) });
  }
});

// Verify eSewa response (server-side) and update order payment_status
router.post('/esewa/verify', async (req, res) => {
  try {
    const secretKey = process.env.ESEWA_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: 'Missing ESEWA_SECRET_KEY in environment' });

    const { data, fields } = req.body || {};
    let payload = null;
    if (data) {
      try {
        const json = Buffer.from(String(data), 'base64').toString('utf-8');
        payload = JSON.parse(json);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid base64 data' });
      }
    } else if (fields && typeof fields === 'object') {
      payload = fields;
    } else {
      return res.status(400).json({ message: 'Missing data or fields to verify' });
    }

    const signedNames = String(payload.signed_field_names || '').split(',').map(s => s.trim()).filter(Boolean);
    if (signedNames.length === 0) return res.status(400).json({ message: 'signed_field_names missing' });
    const message = signedNames.map(name => `${name}=${payload[name] ?? ''}`).join(',');
    const expected = signEsewa(secretKey, message);
    const provided = String(payload.signature || '');
    const verified = expected === provided;
    if (!verified) return res.status(400).json({ verified: false, message: 'Signature mismatch' });

    // If transaction_uuid present, mark the order as paid
    let updated = 0, orderId = null;
    try {
      const txn = payload.transaction_uuid ? String(payload.transaction_uuid) : null;
      if (txn) {
        const [rows] = await pool.query('SELECT id FROM orders WHERE esewa_transaction_uuid = ? LIMIT 1', [txn]);
        const order = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (order) {
          orderId = order.id;
          await pool.query('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', ['paid', 'confirmed', orderId]);
          updated = 1;
          // Write ledger entry on verify
          try {
            const amount = Number(payload.total_amount || payload.amount || 0) || null;
            await pool.query(
              'INSERT INTO payment_ledger (order_id, method, gateway_txn_id, amount, currency, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [orderId, 'esewa', txn, amount, 'NPR', 'verified', JSON.stringify(payload)]
            );
          } catch {}
        }
      }
    } catch (e) {
      // non-fatal
    }

    return res.json({ verified: true, orderId, updated });
  } catch (e) {
    return res.status(500).json({ message: 'Verification failed', error: e && e.message ? e.message : String(e) });
  }
});

// Helper to verify payload object with signed_field_names
function verifyEsewaPayload(payload, secretKey) {
  const signedNames = String(payload.signed_field_names || '').split(',').map(s => s.trim()).filter(Boolean);
  if (signedNames.length === 0) return { verified: false, message: 'signed_field_names missing' };
  const message = signedNames.map(name => `${name}=${payload[name] ?? ''}`).join(',');
  const expected = signEsewa(secretKey, message);
  const provided = String(payload.signature || '');
  const verified = expected === provided;
  return { verified, message: verified ? 'ok' : 'Signature mismatch' };
}

async function markOrderPaidByTxn(pool, txn) {
  try {
    if (!txn) return { updated: 0, orderId: null };
    const [rows] = await pool.query('SELECT id FROM orders WHERE esewa_transaction_uuid = ? LIMIT 1', [txn]);
    const order = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!order) return { updated: 0, orderId: null };
    const orderId = order.id;
    await pool.query('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', ['paid', 'confirmed', orderId]);
    return { updated: 1, orderId };
  } catch (e) {
    return { updated: 0, orderId: null };
  }
}

// eSewa redirects (often POST) to success_url/failure_url. Accept both and redirect to client.
const handleEsewaSuccess = async (req, res) => {
  try {
    const secretKey = process.env.ESEWA_SECRET_KEY;
    const clientBase = resolveClientBase();
    if (!secretKey) return res.status(500).send('Missing ESEWA_SECRET_KEY');

    // eSewa can send a base64 'data' or raw fields
    const dataParam = req.body?.data || req.query?.data;
    let payload = null;
    if (dataParam) {
      try {
        const json = Buffer.from(String(dataParam), 'base64').toString('utf-8');
        payload = JSON.parse(json);
      } catch {}
    }
    if (!payload) payload = Object.assign({}, req.body, req.query);

    const { verified } = verifyEsewaPayload(payload, secretKey);
    if (!verified) return res.redirect(302, `${clientBase}/failure?method=esewa&reason=signature`);

    const txn = payload.transaction_uuid ? String(payload.transaction_uuid) : null;
  const { orderId } = await markOrderPaidByTxn(pool, txn);
    // Record ledger on success redirect as well (idempotent-ish)
    try {
      const amount = Number(payload.total_amount || payload.amount || 0) || null;
      if (txn) {
        await pool.query(
          'INSERT INTO payment_ledger (order_id, method, gateway_txn_id, amount, currency, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [orderId, 'esewa', txn, amount, 'NPR', 'verified', JSON.stringify(payload)]
        );
      }
    } catch {}
  // Prefer redirecting directly to order details page for a better UX
  const to = orderId ? `${clientBase}/order/${orderId}` : `${clientBase}/success?method=esewa`;
    return res.redirect(302, to);
  } catch (e) {
  const clientBase = resolveClientBase();
    return res.redirect(302, `${clientBase}/failure?method=esewa`);
  }
};

const handleEsewaFailure = async (req, res) => {
  const clientBase = resolveClientBase();
  const txn = req.body?.transaction_uuid || req.query?.transaction_uuid || '';
  return res.redirect(302, `${clientBase}/failure?method=esewa${txn ? `&txn=${encodeURIComponent(txn)}` : ''}`);
};

router.post('/esewa/success', handleEsewaSuccess);
router.get('/esewa/success', handleEsewaSuccess);
router.post('/esewa/failure', handleEsewaFailure);
router.get('/esewa/failure', handleEsewaFailure);

module.exports = router;
// ===================== KHALTI =====================
// Initiate Khalti payment (server to server) to get a payment_url and pidx
router.post('/khalti/initiate', async (req, res) => {
  try {
    const { amount, productName, orderId } = req.body || {};
    const secretKey = process.env.KHALTI_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: 'Missing KHALTI_SECRET_KEY in environment' });
    const clientBase = resolveClientBase();
    const serverBase = resolveServerBase();
    const amt = Number(amount);
    if (!amt || !isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const amountPaisa = Math.round(amt * 100);

  // Ensure uniqueness across retries to avoid duplicate purchase_order_id errors at Khalti
  const purchase_order_id = orderId ? `order-${Number(orderId)}-${Date.now()}` : `order-${Date.now()}`;
    const purchase_order_name = productName || 'Order Payment';

    const body = {
      return_url: `${serverBase}/api/payments/khalti/return`,
      website_url: clientBase,
      amount: amountPaisa,
      purchase_order_id,
      purchase_order_name,
    };

    const resp = await fetch('https://a.khalti.com/api/v2/epayment/initiate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${secretKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      try { console.error('[Khalti] initiate error', resp.status, text); } catch {}
      return res.status(502).json({ message: 'Khalti initiate failed', status: resp.status, error: text });
    }
    const data = await resp.json(); // contains pidx, payment_url
    const pidx = data.pidx || null;
    const payment_url = data.payment_url || null;
    if (!payment_url || !pidx) return res.status(502).json({ message: 'Khalti did not return payment_url/pidx' });

    // Map order to pidx for later verification
    if (orderId && pidx) {
      try {
        await pool.query('UPDATE orders SET khalti_pidx = ?, payment_method = ?, payment_status = ? WHERE id = ?', [
          String(pidx), 'khalti', 'pending', Number(orderId)
        ]);
      } catch (e) { /* non-fatal */ }
    }

    return res.json({ payment_url, pidx });
  } catch (e) {
    try { console.error('[Khalti] initiate exception', e); } catch {}
    return res.status(500).json({ message: 'Failed to initiate Khalti payment', error: e && e.message ? e.message : String(e) });
  }
});

// Handle Khalti return with pidx -> verify via lookup and redirect to order page
router.all('/khalti/return', async (req, res) => {
  try {
    const secretKey = process.env.KHALTI_SECRET_KEY;
    const clientBase = resolveClientBase();
    if (!secretKey) return res.status(500).send('Missing KHALTI_SECRET_KEY');

    const pidx = req.query?.pidx || req.body?.pidx;
    if (!pidx) return res.redirect(302, `${resolveClientBase()}/failure?method=khalti&reason=missing-pidx`);

    const lookup = await fetch('https://a.khalti.com/api/v2/epayment/lookup/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${secretKey}`,
      },
      body: JSON.stringify({ pidx }),
    });
    if (!lookup.ok) {
      const errText = await lookup.text().catch(() => '');
      return res.redirect(302, `${resolveClientBase()}/failure?method=khalti&reason=lookup-${lookup.status}`);
    }
  const info = await lookup.json();
  try { console.log('[Khalti] lookup', { pidx: String(pidx), status: info?.status, amount: info?.total_amount, txn: info?.transaction_id }); } catch {}
    const statusLc = String(info.status || '').toLowerCase();
    const completed = statusLc === 'completed';

    let to = `${resolveClientBase()}/failure?method=khalti&reason=${encodeURIComponent(statusLc || 'unknown')}`;
    try {
      const [rows] = await pool.query('SELECT id FROM orders WHERE khalti_pidx = ? LIMIT 1', [String(pidx)]);
      const order = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (order) {
        if (completed) {
          await pool.query('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', ['paid', 'confirmed', order.id]);
          // Write ledger row for completed Khalti payment
          try {
            const txnId = info?.transaction_id || String(pidx);
            const amount = info?.total_amount != null ? Number(info.total_amount) / 100 : null; // Khalti amount in paisa
            await pool.query(
              'INSERT INTO payment_ledger (order_id, method, gateway_txn_id, amount, currency, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [order.id, 'khalti', txnId, amount, 'NPR', 'verified', JSON.stringify(info)]
            );
          } catch {}
          to = `${clientBase}/order/${order.id}`;
        } else if (statusLc === 'pending' || statusLc === 'initiated') {
          // Show order page with pending state rather than immediate failure
          to = `${resolveClientBase()}/order/${order.id}?payment=pending&method=khalti`;
        } else {
          to = `${resolveClientBase()}/failure?method=khalti&reason=${encodeURIComponent(statusLc || 'unknown')}`;
        }
      }
    } catch (e) { /* non-fatal */ }

    return res.redirect(302, to);
  } catch (e) {
    const clientBase = process.env.CLIENT_BASE_URL || process.env.BASE_URL || 'http://localhost:8080';
    return res.redirect(302, `${resolveClientBase()}/failure?method=khalti&reason=exception`);
  }
});

// POST /api/payments/verify { method: 'esewa'|'khalti'|'cod', orderId?, txn? }
router.post('/verify', async (req, res) => {
  try {
    const { method, orderId: rawOrderId, txn } = req.body || {};
    const methodLc = String(method || '').toLowerCase();
    if (!methodLc) return res.status(400).json({ ok: false, message: 'method required' });

    let orderId = rawOrderId ? Number(rawOrderId) : null;
    let gateway_txn_id = txn ? String(txn) : null;
    let amount = null;
    let reconciled = false;

    // If orderId not provided, try to resolve via txn mapping on orders
    if (!orderId && gateway_txn_id) {
      if (methodLc === 'esewa') {
        const [rows] = await pool.query('SELECT id, total FROM orders WHERE esewa_transaction_uuid = ? LIMIT 1', [gateway_txn_id]);
        if (Array.isArray(rows) && rows[0]) { orderId = rows[0].id; amount = rows[0].total; }
      } else if (methodLc === 'khalti') {
        const [rows] = await pool.query('SELECT id, total FROM orders WHERE khalti_pidx = ? LIMIT 1', [gateway_txn_id]);
        if (Array.isArray(rows) && rows[0]) { orderId = rows[0].id; amount = rows[0].total; }
      }
    }

    if (orderId) {
      const [rows] = await pool.query('SELECT id, total, payment_status, esewa_transaction_uuid, khalti_pidx FROM orders WHERE id = ? LIMIT 1', [orderId]);
      const ord = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (ord) {
        amount = amount ?? ord.total;
        if (methodLc === 'esewa') {
          reconciled = !!ord.esewa_transaction_uuid && (!gateway_txn_id || ord.esewa_transaction_uuid === String(gateway_txn_id));
          gateway_txn_id = gateway_txn_id || ord.esewa_transaction_uuid || null;
        } else if (methodLc === 'khalti') {
          reconciled = !!ord.khalti_pidx && (!gateway_txn_id || ord.khalti_pidx === String(gateway_txn_id));
          gateway_txn_id = gateway_txn_id || ord.khalti_pidx || null;
        } else if (methodLc === 'cod') {
          // Cash on Delivery: considered pending until order delivered
          reconciled = String(ord.payment_status || '').toLowerCase() === 'paid';
        }
      }
    }

    try {
      const payload = JSON.stringify({ method: methodLc, orderId, txn: gateway_txn_id, client: req.headers['user-agent'] || null });
      await pool.query(
        'INSERT INTO payment_ledger (order_id, method, gateway_txn_id, amount, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, methodLc, gateway_txn_id, amount, reconciled ? 'verified' : 'pending', payload]
      );
    } catch (e) { /* non-fatal */ }

    return res.json({ ok: true, reconciled, orderId, txn: gateway_txn_id });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'verify failed', error: e && e.message ? e.message : String(e) });
  }
});

// GET /api/payments/ledger
router.get('/ledger', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, order_id, method, gateway_txn_id, amount, currency, status, created_at FROM payment_ledger ORDER BY id DESC LIMIT 50');
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(500).json({ message: 'failed to read ledger' });
  }
});
