/**
 * Insert Admin User if Not Exists
 * Run this once to seed the admin user
 * Usage: node seed-admin.js
 */

require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  try {
    const email = 'thriftsy.np@gmail.com';
    const password = 'thriftsy@123';
    const name = 'Thriftsy Admin';

    console.log('🔍 Checking if admin exists...');
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`✅ Admin user already exists with email: ${email}`);
      console.log(`   ID: ${existing[0].id}`);
      return;
    }

    console.log('⏳ Creating admin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin']
    );

    console.log(`✅ Admin user created successfully!`);
    console.log(`\n📋 Admin Credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: admin`);
    console.log(`   User ID: ${result.insertId}`);
    console.log(`\n🚀 You can now log in at /signin with these credentials`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedAdmin();
