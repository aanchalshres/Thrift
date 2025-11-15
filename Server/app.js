// Server/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const initDb = require("./config/initDb"); 
const path = require("path");


// Routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const userRoutes = require("./routes/users");
const orderRoutes = require("./routes/orders");
const messageRoutes = require("./routes/messages");
const categoriesRoutes = require("./routes/categories");
const wishlistRoutes = require("./routes/wishlist");
const adminRoutes = require("./routes/admin");
const paymentsRoutes = require("./routes/payments");
const reviewsRoutes = require("./routes/reviews");
const sellerFeedbackRoutes = require("./routes/sellerFeedback");
const notificationsRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 5000;

// ===== Middleware =====
// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'https://thriftsyy.vercel.app',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowedOrigins or if not in production
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static: serve uploaded files (for product images)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ===== Routes =====
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Simple health check for quick verification
app.get('/_health', (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/sellers", sellerFeedbackRoutes);
app.use("/api/notifications", notificationsRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ===== Start server with database initialization =====
(async () => {
  try {
    await initDb(); // Initialize database and tables
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
})();
