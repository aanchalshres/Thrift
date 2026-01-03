const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
  const {
    DB_HOST = 'localhost',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASS = '',
    DB_NAME = 'thriftsydb',
  } = process.env;

  const dbConfig = {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS || '',
  };

  console.log(`Connecting to database at ${DB_HOST}:${DB_PORT}...`);

  let conn;
  let retries = 3;
  let lastError;

  while (retries > 0) {
    try {
      console.log(`Attempt ${4 - retries}/3`);
      conn = await mysql.createConnection({
        ...dbConfig,
        multipleStatements: true,
      });
      console.log(`✅ Connected to database`);
      break;
    } catch (error) {
      lastError = error;
      retries--;
      console.error(`❌ Connection failed: ${error.message}`);
      if (retries > 0) {
        console.log(`Retrying in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  if (!conn) {
    throw new Error(`Failed to connect to database: ${lastError.message}`);
  }

  await conn.execute(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.end();

  // Ensure tables exist
  const pool = require('../db');
  // Helper: ensure a column exists on a table (additive only)
  async function ensureColumn(table, columnDef, afterColumn) {
    const colName = columnDef.split(/\s+/)[0];
    try {
      const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [colName]);
      if (Array.isArray(cols) && cols.length > 0) return; // already exists
      const after = afterColumn ? ` AFTER \`${afterColumn}\`` : '';
      await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${columnDef}${after}`);
    } catch (e) {
      console.error(`Failed ensuring column ${table}.${colName}:`, e);
    }
  }
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      phone VARCHAR(20) NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Categories
    `CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(120) NOT NULL UNIQUE,
      parent_id INT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      title VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      originalPrice DECIMAL(10,2),
      brand VARCHAR(100),
      size VARCHAR(50),
      productCondition VARCHAR(50),
      seller VARCHAR(100),
      phone VARCHAR(20) NULL,
      location VARCHAR(100),
      image VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS product_images (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id INT UNSIGNED NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    /* NEW: orders and order_items */
    `CREATE TABLE IF NOT EXISTS orders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      tax DECIMAL(12,2) NOT NULL,
      shipping DECIMAL(12,2) NOT NULL,
      total DECIMAL(12,2) NOT NULL,
      payment_method VARCHAR(50),
      payment_status VARCHAR(50) DEFAULT 'pending',
      shipping_address JSON,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS order_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NULL,
      title VARCHAR(255) NOT NULL,
      price DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Seller-centric sales table to avoid complex joins for "Orders Sold"
    `CREATE TABLE IF NOT EXISTS seller_sales (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      seller_id INT UNSIGNED NOT NULL,
      order_id INT UNSIGNED NOT NULL,
      buyer_id INT UNSIGNED NULL,
      product_id INT UNSIGNED NULL,
      title VARCHAR(255) NOT NULL,
      price DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_seller (seller_id),
      KEY idx_seller_order (seller_id, order_id),
      CONSTRAINT fk_seller_sales_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_seller_sales_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Messages (in-app)
    `CREATE TABLE IF NOT EXISTS messages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id INT UNSIGNED NOT NULL,
      sender_id INT UNSIGNED NULL,
      recipient_id INT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_messages_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Notifications (simple)
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      payload JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Wishlist (per-user saved products)
    `CREATE TABLE IF NOT EXISTS wishlist_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_product (user_id, product_id),
      CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Cart (per-user shopping cart)
    `CREATE TABLE IF NOT EXISTS cart_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      quantity INT UNSIGNED DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_product (user_id, product_id),
      CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Minimal payment ledger for reconciliation demos
    `CREATE TABLE IF NOT EXISTS payment_ledger (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NULL,
      method VARCHAR(30) NOT NULL,
      gateway_txn_id VARCHAR(150) NULL,
      amount DECIMAL(12,2) NULL,
      currency VARCHAR(10) DEFAULT 'NPR',
      status VARCHAR(30) DEFAULT 'pending',
      raw_payload JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_order (order_id),
      KEY idx_method (method),
      CONSTRAINT fk_payment_ledger_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Order audit log (status & payment transitions)
    `CREATE TABLE IF NOT EXISTS order_audit_log (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NOT NULL,
      actor_id INT UNSIGNED NULL,
      field VARCHAR(40) NOT NULL,
      old_value VARCHAR(100) NULL,
      new_value VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_order (order_id),
      CONSTRAINT fk_order_audit_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_order_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Product reviews
    `CREATE TABLE IF NOT EXISTS reviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NULL,
      rating TINYINT NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_prod (product_id),
      KEY idx_user (user_id),
      CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // Seller verification applications

    // Peer seller trust: feedback after purchase
    `CREATE TABLE IF NOT EXISTS seller_feedback (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NOT NULL,
      seller_id INT UNSIGNED NOT NULL,
      buyer_id INT UNSIGNED NOT NULL,
      as_described TINYINT(1) NOT NULL DEFAULT 1,
      rating TINYINT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_order_buyer_seller (order_id, buyer_id, seller_id),
      KEY idx_seller (seller_id),
      KEY idx_buyer (buyer_id),
      CONSTRAINT fk_sf_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_sf_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_sf_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  ];

  for (const sql of statements) {
    try {
      await pool.execute(sql);
    } catch (err) {
      console.error('Failed running statement:', err);
    }
  }
  // Strengthen seller_sales relations and indexes for clarity and performance
  try {
    // Ensure indexes exist
    const ensureIndex = async (table, indexName, indexDefSql) => {
      try {
        const [idxRows] = await pool.query(
          `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
          [DB_NAME, table, indexName]
        );
        if (!Array.isArray(idxRows) || idxRows.length === 0) {
          await pool.execute(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` ${indexDefSql}`);
        }
      } catch (e) {
        console.warn(`Index ensure warning ${table}.${indexName}:`, e && e.message ? e.message : e);
      }
    };

    await ensureIndex('seller_sales', 'idx_order', '(order_id)');
    await ensureIndex('seller_sales', 'idx_product', '(product_id)');
    await ensureIndex('seller_sales', 'idx_buyer', '(buyer_id)');

    // Ensure foreign keys exist for buyer_id and product_id
    const ensureFK = async (table, col, refTable, refCol, fkName, onDelete = 'SET NULL') => {
      try {
        const [fkRows] = await pool.query(
          `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
             AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?`,
          [DB_NAME, table, col, refTable, refCol]
        );
        if (!Array.isArray(fkRows) || fkRows.length === 0) {
          try {
            await pool.execute(
              `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`${refCol}\`) ON DELETE ${onDelete}`
            );
          } catch (e) {
            if (!(e && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_CANT_CREATE_TABLE'))) {
              console.warn(`FK add warning ${table}.${col} -> ${refTable}.${refCol}:`, e && e.message ? e.message : e);
            }
          }
        }
      } catch (e) {
        console.warn(`FK check warning for ${table}.${col}:`, e && e.message ? e.message : e);
      }
    };

    await ensureFK('seller_sales', 'buyer_id', 'users', 'id', 'fk_seller_sales_buyer', 'SET NULL');
    await ensureFK('seller_sales', 'product_id', 'products', 'id', 'fk_seller_sales_product', 'SET NULL');
  } catch (e) {
    console.warn('seller_sales strengthen warning:', e && e.message ? e.message : e);
  }
  
  await ensureColumn('users', 'phone VARCHAR(20) NULL', 'email');
  // Basic RBAC: user role column
  await ensureColumn('users', "role VARCHAR(30) NOT NULL DEFAULT 'user'", 'phone');
  // Migrate legacy 'buyer' role values to unified 'user'
  try {
    await pool.query("UPDATE users SET role='user' WHERE role='buyer'");
  } catch (e) {
    console.warn('Role migration buyer->user warning:', e && e.message ? e.message : e);
  }
  await ensureColumn('products', 'phone VARCHAR(20) NULL', 'seller');
  await ensureColumn('products', 'user_id INT UNSIGNED NULL', 'id');
  await ensureColumn('products', 'category VARCHAR(50) NULL', 'size');
  await ensureColumn('products', 'category_id INT UNSIGNED NULL', 'category');
  // Minimal seller status support for listings: unsold | order_received | sold
  await ensureColumn('products', "status VARCHAR(30) NOT NULL DEFAULT 'unsold'", 'image');
  // (Deprecated) Seller verification columns (kept for backward compatibility if present)
  await ensureColumn('users', "is_verified_seller TINYINT(1) NOT NULL DEFAULT 0", 'role');
  await ensureColumn('users', 'seller_tier VARCHAR(30) NULL', 'is_verified_seller');
  // Password reset fields
  await ensureColumn('users', 'reset_token VARCHAR(100) NULL', 'seller_tier');
  await ensureColumn('users', 'reset_token_expires DATETIME NULL', 'reset_token');
  // Map orders to eSewa transaction UUID when initiating payment
  await ensureColumn('orders', 'esewa_transaction_uuid VARCHAR(100) NULL', 'payment_status');
  // Map orders to Khalti payment pidx for verification
  await ensureColumn('orders', 'khalti_pidx VARCHAR(100) NULL', 'esewa_transaction_uuid');
  // Idempotency key to prevent duplicate orders on retries
  await ensureColumn('orders', 'idempotency_key VARCHAR(128) NULL', 'khalti_pidx');

  // Ensure foreign key exists for products.user_id -> users.id
  try {
    const [fkRows] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'user_id'
         AND REFERENCED_TABLE_NAME = 'users' AND REFERENCED_COLUMN_NAME = 'id'`,
      [DB_NAME]
    );
    if (!Array.isArray(fkRows) || fkRows.length === 0) {
      // Add FK with a stable name; ignore if it already exists under a different name
      try {
        await pool.execute(
          'ALTER TABLE `products` ADD CONSTRAINT `fk_products_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL'
        );
      } catch (e) {
        // If it fails due to existing constraint name, ignore
        if (!(e && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_CANT_CREATE_TABLE'))) {
          console.warn('FK add warning products.user_id -> users.id:', e && e.message ? e.message : e);
        }
      }
    }
  } catch (e) {
    console.warn('FK check warning for products.user_id:', e && e.message ? e.message : e);
  }

  // Ensure foreign key exists for products.category_id -> categories.id
  try {
    const [fkRows2] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'category_id'
         AND REFERENCED_TABLE_NAME = 'categories' AND REFERENCED_COLUMN_NAME = 'id'`,
      [DB_NAME]
    );
    if (!Array.isArray(fkRows2) || fkRows2.length === 0) {
      try {
        await pool.execute(
          'ALTER TABLE `products` ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL'
        );
      } catch (e) {
        if (!(e && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_CANT_CREATE_TABLE'))) {
          console.warn('FK add warning products.category_id -> categories.id:', e && e.message ? e.message : e);
        }
      }
    }
  } catch (e) {
    console.warn('FK check warning for products.category_id:', e && e.message ? e.message : e);
  }

  // Backfill categories table and link products.category_id
  try {
    // helper slugify
    const slugify = (str) => String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const [distinctCats] = await pool.query(
      `SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ''`
    );
    const catRows = Array.isArray(distinctCats) ? distinctCats : [];
    for (const row of catRows) {
      const name = row.category;
      const slug = slugify(name);
      if (!slug) continue;
      // insert if not exists
      const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ?', [slug]);
      let catId = (Array.isArray(existing) && existing[0]) ? existing[0].id : null;
      if (!catId) {
        const [ins] = await pool.query('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
        catId = ins.insertId;
      }
      // link products by case-insensitive match
      await pool.query('UPDATE products SET category_id = ? WHERE category_id IS NULL AND LOWER(category) = LOWER(?)', [catId, name]);
    }
  } catch (e) {
    console.warn('Backfill categories warning:', e && e.message ? e.message : e);
  }
  // Optional admin bootstrap: promote a specific email to admin if no admin exists yet
  try {
    const [admins] = await pool.query("SELECT COUNT(*) AS cnt FROM users WHERE role='admin'");
    const adminCount = Array.isArray(admins) && admins[0] ? Number(admins[0].cnt) : 0;
    const seedEmail = (process.env.ADMIN_EMAIL || '').trim();
    if (adminCount === 0 && seedEmail) {
      const [u] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [seedEmail]);
      if (Array.isArray(u) && u.length > 0) {
        await pool.query("UPDATE users SET role='admin' WHERE id = ?", [u[0].id]);
        console.log(`Admin bootstrap: promoted ${seedEmail} to admin.`);
      } else {
        console.warn(`Admin bootstrap: ADMIN_EMAIL=${seedEmail} not found in users table. Sign up this email first, then restart server.`);
      }
    }
  } catch (e) {
    console.warn('admin bootstrap warning:', e && e.message ? e.message : e);
  }

  // Auto-seed default admin if no admins exist
  try {
    const [admins] = await pool.query("SELECT COUNT(*) AS cnt FROM users WHERE role='admin'");
    const adminCount = Array.isArray(admins) && admins[0] ? Number(admins[0].cnt) : 0;
    
    if (adminCount === 0) {
      const defaultAdminEmail = 'thriftsy.np@gmail.com';
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [defaultAdminEmail]);
      
      if (!Array.isArray(existing) || existing.length === 0) {
        // Create default admin if doesn't exist
        const bcryptjs = require('bcryptjs');
        const hashedPassword = await bcryptjs.hash('thriftsy@123', 10);
        const [result] = await pool.query(
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
          ['Thriftsy Admin', defaultAdminEmail, hashedPassword, 'admin']
        );
        console.log(`✅ Auto-created default admin user: ${defaultAdminEmail}`);
      } else {
        // Just promote existing user
        await pool.query("UPDATE users SET role='admin' WHERE email = ?", [defaultAdminEmail]);
        console.log(`✅ Promoted existing user to admin: ${defaultAdminEmail}`);
      }
    }
  } catch (e) {
    console.warn('auto-seed admin warning:', e && e.message ? e.message : e);
  }

  console.log('✅ Database and tables are ready');
}

module.exports = initDb;

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}