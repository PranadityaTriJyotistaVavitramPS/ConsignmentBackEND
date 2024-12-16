const jwt = require('jsonwebtoken');

exports.authenticateResetToken = (req, res, next) => {
  const { resetToken } = req.body;

  if (!resetToken) {
    return res.status(401).json({ error: "Reset token is required!" });
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded token to request
    next();
  } catch (err) {
    console.error("Invalid reset token:", err);
    return res.status(401).json({ error: "Invalid or expired reset token!" });
  }
};
