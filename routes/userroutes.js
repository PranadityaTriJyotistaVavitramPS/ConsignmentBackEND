const express = require('express');
const router = express.Router();
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authenticate");
const { getAllUsers, getUserById, createUser, uploadProfileImage, deleteUser } = require("../controllers/userController");

router.get('/', userController.getAllUsers);
router.get('/getSingleUser',authenticate, userController.getUserById);
router.post('/loginUser',userController.login);
router.post('/createUser', userController.uploadProfileImage, userController.createUser);
router.put('/updateUser',authenticate, userController.uploadProfileImage, userController.updateUser)
router.delete('/:id/deleteUser', userController.deleteUser);

module.exports = router;
