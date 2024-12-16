const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController.js');
const authenticateUser = require('../middleware/authenticate');

router.post('/makeRating/:id', authenticateUser, ratingController.addRating);

module.exports = router;