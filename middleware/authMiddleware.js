const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('❌ CRITICAL: JWT_SECRET environment variable is not set');
      return res.status(500).render('error', { 
        error: 'Server configuration error. Please contact administrator.' 
      });
    }

    let token = req.cookies.token;

    if (!token) {
      console.log('No token found, redirecting to login');
      return res.redirect('/auth/login');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      res.clearCookie("token");
      return res.redirect('/auth/login');
    }

    next();
    
  } catch (error) {
    console.error('❌ AUTH ERROR DETAILS:');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    
    if (error.name === 'JsonWebTokenError') {
      console.error('JWT Error - likely secret mismatch');
    }
    
    res.clearCookie("token");
    res.redirect('/auth/login');
  }
};

module.exports = { protect };