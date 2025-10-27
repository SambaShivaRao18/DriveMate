const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const providerRoutes = require("./routes/providerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const path = require('path');

// Import the required middleware and controller
const { protect } = require("./middleware/authMiddleware");
const { showDashboard } = require("./controllers/authController");

dotenv.config();

// Add debug logging here
console.log('🔧 Environment Variables Check:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Loaded' : '❌ Missing');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Loaded' : '❌ Missing');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/provider', providerRoutes);
app.use('/api/payments', paymentRoutes);

// ======================
// ADD DIRECT DASHBOARD ROUTE HERE
// ======================
app.get('/dashboard', protect, showDashboard);

// ======================
// CLOUDINARY TEST ROUTE
// ======================
app.get('/test-cloudinary', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    
    // Test configuration
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    // Simple test - list folders
    const result = await cloudinary.api.root_folders();
    res.json({ 
      success: true, 
      message: 'Cloudinary connected successfully',
      folders: result.folders 
    });
  } catch (error) {
    console.error('Cloudinary test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      config: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
        api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
        api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing'
      }
    });
  }
});

// Home route
app.get("/", (req, res) => {
  res.render('pages/home', { 
    title: 'Roadside Assistance',
    user: req.user || null
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});