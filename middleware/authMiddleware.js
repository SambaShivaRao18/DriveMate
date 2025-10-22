const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies
    if (req.cookies.token) {
      token = req.cookies.token;
    }

    // Check for token in authorization header (fallback)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('No token found, redirecting to login');
      return res.redirect('/auth/login');
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log('User not found for token');
        return res.redirect('/auth/login');
      }

      console.log('User authenticated:', req.user.email);
      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.redirect('/auth/login');
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.redirect('/auth/login');
  }
};

module.exports = { protect };