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

dotenv.config();

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static("public"));

// Set EJS Engine
app.set("view engine", "ejs");

// ======================
// VIEW ROUTES
// ======================

// Home page
app.get("/", (req, res) => {
  res.render('pages/home', { user: null });
});

// Track request page
app.get("/track", (req, res) => {
  res.render('pages/track-request', { user: null });
});

// Login page redirect
app.get("/login", (req, res) => {
  res.redirect('/auth/login');
});

// Register page redirect  
app.get("/register", (req, res) => {
  res.redirect('/auth/register');
});

// Dashboard redirect
app.get("/dashboard", (req, res) => {
  res.redirect('/auth/dashboard');
});

// ======================
// API ROUTES
// ======================

app.use("/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/provider", providerRoutes);

// ======================
// TEST ROUTE
// ======================

app.get("/test", (req, res) => {
  res.json({ 
    message: "Server is working ✅",
    timestamp: new Date().toISOString()
  });
});

// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});