require("dotenv").config();
const redis = require("redis");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');
const { query } = require('../db/index'); // Mengimpor fungsi query dari db


// Initialize Redis client
const redisClient = redis.createClient({
  host: "127.0.0.1", // Redis server address
  port: 6379,        // Redis server port
});

redisClient.on("connect", () => {
  console.log("Connected to Redis!");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

// Ensure the Redis client connects before handling any requests
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Error connecting to Redis:", err);
  }
})();

// Helper function to generate random OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString(); // Generates a 6-digit OTP
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Configure NodeMailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // You can replace this with other services like Yahoo or Outlook
  auth: {
    user: process.env.GMAIL_USER,       // Your Gmail address
    pass: process.env.GMAIL_PASS,         // App password (not your Gmail password)
  },
});

// Controller: Generate OTP
exports.generateOTP = (req, res) => {
  const { email } = req.body; // Replace `phoneNumber` with `email`
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email address!" });
  }

  const otp = generateOTP();
  const expirationTime = 300; // 5 minutes

  // Save OTP in Redis
  redisClient
    .set(email, otp, { EX: expirationTime }) // Save OTP against the email in Redis
    .then(() => {
      // Send OTP via email using NodeMailer
      const mailOptions = {
        from: `"ConsignmentHIMATEKKOM" <${process.env.GMAIL_USER}>`, // Sender's name and email
        to: email,                                     // Recipient's email
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}`,              // OTP in plain text
      };

      return transporter.sendMail(mailOptions);
    })
    .then(() => {
      if (process.env.NODE_ENV === "development") {
        console.log(`OTP sent successfully to ${email}: ${otp}`);
      }
      res.status(200).json({
        message: "OTP sent successfully to your email!",
      });
    })
    .catch((err) => {
      console.error("Error sending OTP via email:", err);
      res.status(500).json({ error: "Internal Server Error" });
    });
};



exports.getStoredOTP = async (req, res) => {
    const { email } = req.body; // Get the email from the request body
  
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email address!" });
    }
  
    try {
      const otp = await redisClient.get(email); // Fetch OTP stored in Redis
      if (otp) {
        return res.status(200).json({ email, otp });
      } else {
        return res.status(404).json({ message: "OTP not found or expired!" });
      }
    } catch (err) {
      console.error("Error fetching OTP from Redis:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
  

//verify OTP
exports.verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
  
    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required!" });
    }
  
    try {
      // Retrieve OTP from Redis
      const storedOtp = await redisClient.get(email);
  
      if (!storedOtp) {
        return res.status(400).json({ error: "OTP expired or not found!" });
      }
  
      if (storedOtp === otp) {
        // OTP is correct, proceed to password reset
        // Optionally, delete the OTP from Redis
        await redisClient.del(email);
  
        // Generate a password reset token (e.g., JWT)
        const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
  
        return res.status(200).json({
          message: "OTP verified successfully!",
          resetToken, // Send this token to the client
        });
      } else {
        return res.status(400).json({ error: "Invalid OTP!" });
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // Controller: Reset Password
exports.resetPassword = async (req, res) => {
    const { resetToken,newPassword } = req.body;
  
    // Validate input
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required!" });
    }
  
    try {
      // Verify the reset token
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      const email = decoded.email;
  
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
  
      // Update the user's password in the database
      const result = await query(
        'UPDATE user_table SET password = $1 WHERE email = $2 RETURNING *',
        [hashedPassword, email]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found!" });
      }
  
      res.status(200).json({ message: "Password updated successfully!" });
    } catch (err) {
      console.error("Error resetting password:", err);
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: "Reset token expired!" });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
  
  