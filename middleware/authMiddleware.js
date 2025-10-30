const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // SET CACHE HEADERS FIRST - BEFORE ANYTHING ELSE
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let token;

    // Check for token in cookies
    if (req.cookies.token) {
      token = req.cookies.token;
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
        res.clearCookie("token");
        return res.redirect('/auth/login');
      }

      console.log('User authenticated:', req.user.email);
      next();
      
    } catch (error) {
      console.error('Token verification failed:', error.message);
      res.clearCookie("token");
      return res.redirect('/auth/login');
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.redirect('/auth/login');
  }
};

module.exports = { protect };