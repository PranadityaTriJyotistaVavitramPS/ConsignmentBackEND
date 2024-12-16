require("dotenv").config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); 
const express = require('express');
const app = express();  
app.use(cookieParser(process.env.JWT_SECRET));

// Middleware to authenticate and get user id from the JWT token
const authenticateUser = (req, res, next) => {
  const token = req.cookies.token; // Get the token from cookies
  if (!token) {
    return res.status(401).json({ message: 'Authorization denied. No token found.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your JWT secret
    req.user = decoded; // Attach the user info to the request
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Token verification failed', err);
    res.status(401).json({ message: 'Invalid token. Authorization denied.' });
  }
};

module.exports = authenticateUser;
