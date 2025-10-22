 
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @desc   Register new user
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    console.log("Registration attempt:", { name, email, role });

    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("User already exists:", email);
      return res.status(400).render('pages/register', { 
        user: null, 
        error: "User already exists with this email" 
      });
    }

    const user = await User.create({ name, email, password, phone, role });
    console.log("User created successfully:", user.email);

    // Generate Token and set cookie
    const token = generateToken(user);
    res.cookie("token", token, { httpOnly: true });

    // AUTO-REDIRECT: If user is fuel-station or mechanic, redirect to provider registration
    if (role === 'fuel-station' || role === 'mechanic') {
      console.log("Redirecting new provider to registration form");
      return res.redirect('/provider/register');
    }

    // Regular users go to dashboard
    res.redirect('/dashboard');

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).render('pages/register', { 
      user: null, 
      error: "Server error during registration" 
    });
  }
};

// @desc   Login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login attempt:", email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found:", email);
      return res.status(400).render('pages/login', { 
        user: null, 
        error: "Invalid email or password" 
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log("Password mismatch for:", email);
      return res.status(400).render('pages/login', { 
        user: null, 
        error: "Invalid email or password" 
      });
    }

    // Generate Token and set cookie
    const token = generateToken(user);
    res.cookie("token", token, { httpOnly: true });

    console.log("Login successful:", user.email);
    
    // Redirect to dashboard after successful login
    res.redirect('/dashboard');

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).render('pages/login', { 
      user: null, 
      error: "Server error during login" 
    });
  }
};

// @desc   Logout user
exports.logoutUser = (req, res) => {
  res.clearCookie("token");
  console.log("User logged out");
  res.redirect('/');
};

// @desc   Show login page
exports.showLogin = (req, res) => {
  res.render('pages/login', { 
    user: null, 
    error: null 
  });
};

// @desc   Show register page
exports.showRegister = (req, res) => {
  res.render('pages/register', { 
    user: null, 
    error: null 
  });
};

// @desc   Show dashboard based on role
exports.showDashboard = async (req, res) => {
  try {
    console.log("Dashboard accessed by:", req.user.email);
    
    res.render('pages/dashboard', { 
      user: req.user,
      service: req.query.service || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).render('pages/dashboard', { 
      user: req.user, 
      error: "Error loading dashboard" 
    });
  }
};