const express = require('express');
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const authenticateUser = require('../middleware/authenticate');

router.get('/',serviceController.getAllService);
router.get('/randomService',serviceController.getRandomService);
router.get('/:id_service',serviceController.getServiceById);
router.post('/createService', authenticateUser,serviceController.uploadImageServices, serviceController.createService);
router.delete('/:id/deleteService', serviceController.deleteService);
router.put('/:id/updateService', serviceController.uploadImageServices, serviceController.updateService);

module.exports = router;