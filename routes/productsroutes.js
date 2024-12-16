// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticateUser = require('../middleware/authenticate');
const { uploadMultiplePhotos,createProduct,updateProduct } = require('../controllers/productController')


// Menghubungkan routes dengan controller

router.get('/getSavedProducts',authenticateUser,productController.getSavedProduct);
router.post('/savedproducts',authenticateUser,productController.savedProduct);
router.post('/createproducts', authenticateUser, uploadMultiplePhotos, createProduct);

router.get('/', productController.getAllProducts);
router.get('/newest',productController.getNewestProducts);
router.get('/:id_product', productController.getProductById);
router.put('/:id/updateProduct', uploadMultiplePhotos, updateProduct);
router.delete('/:id/deleteProduct', productController.deleteProduct);

module.exports = router;
