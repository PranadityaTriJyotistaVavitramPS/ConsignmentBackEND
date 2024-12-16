const { query } = require('../db/index'); // Mengimpor fungsi query dari db
const multer = require('multer');
const upload = multer({ dest: './ProductImages' }); // Atur path sesuai kebutuhan Anda
const fs = require('fs');
const fsp = require('fs').promises;
const FormData = require('form-data');
const axios = require('axios');


// Mendapatkan semua produk
exports.getAllProducts = async (req, res) => {
    try {
        const result = await query(`SELECT * FROM products`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};

exports.getNewestProducts =async(req,res) =>{
    try {
        const result = await query(
            `SELECT 
                products.*,
                user_table.profile_image_url,
                user_table.username AS seller_name 
            FROM 
                products
            JOIN
                user_table
            ON
                products.id_user = user_table.id_user 
            ORDER BY 
                created_at 
            DESC 
            LIMIT 4`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
}

// Mendapatkan produk berdasarkan ID
exports.getProductById = async (req, res) => {
    const { id_product } = req.params;

    try {
        const product = await query(
            `SELECT 
                products.*, 
                user_table.profile_image_url, 
                user_table.username AS seller_name
             FROM 
                products 
             JOIN 
                user_table 
             ON 
                products.id_user = user_table.id_user 
             WHERE 
                products.id_product = $1`,
            [id_product]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(product.rows[0]);

        console.log(product.rows[0])
    } catch (error) {
        console.error('Error in getProductById:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Middleware untuk menangani unggahan tiga file foto
exports.uploadMultiplePhotos = upload.fields([
    { name: 'product1_photo', maxCount: 1 },
    { name: 'product2_photo', maxCount: 1 },
    { name: 'product3_photo', maxCount: 1 }
]);

//membuat produk
exports.createProduct = async (req, res) => {
    const { product_name, init_name, last_name, product_desc, price, phone_number, ecommerce_phone, product_link, kategori,pickup,request,googlemaplink } = req.body;
    const photos = req.files; // Mendapatkan file gambar dari req.files
    const userId = req.user.id_user;

    try {
        // Mencari id_kategori dari tabel categories
        const categoryResult = await query(
            "SELECT id_kategori FROM categories WHERE nama_category = $1",
            [kategori]
        );

        if (categoryResult.rowCount === 0) {
            return res.status(400).json({ message: "Category not found" });
        }

        const id_kategori = categoryResult.rows[0].id_kategori;

        // Upload setiap foto ke Imgur dan simpan deletehash
        const uploadPhotoToImgur = async (photo) => {
            const form = new FormData();
            form.append('image', fs.createReadStream(photo.path));

            const response = await axios.post('https://api.imgur.com/3/image', form, {
                headers: {
                    Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                    ...form.getHeaders(),
                },
            });
            return {
                url: response.data.data.link, // URL gambar dari Imgur
                deletehash: response.data.data.deletehash // deletehash dari Imgur
            };
        };

        // Upload foto-foto jika ada, dan simpan URL serta deletehash-nya
        const product1 = photos.product1_photo ? await uploadPhotoToImgur(photos.product1_photo[0]) : { url: null, deletehash: null };
        const product2 = photos.product2_photo ? await uploadPhotoToImgur(photos.product2_photo[0]) : { url: null, deletehash: null };
        const product3 = photos.product3_photo ? await uploadPhotoToImgur(photos.product3_photo[0]) : { url: null, deletehash: null };

        // Hapus file dari folder sementara setelah upload
        if (photos.product1_photo) await fsp.unlink(photos.product1_photo[0].path);
        if (photos.product2_photo) await fsp.unlink(photos.product2_photo[0].path);
        if (photos.product3_photo) await fsp.unlink(photos.product3_photo[0].path);

        // Insert data produk ke database beserta deletehash
        const result = await query(
            `INSERT INTO products (product_name, init_name, last_name, product_desc, price, phone_number, ecommerce_phone, product_link, product1_photo, product2_photo, product3_photo, product1_deletehash, product2_deletehash, product3_deletehash, kategori, id_kategori,id_user,avg_rating, total_ratings,pickup,request,googlemaplink) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,$17,$18,$19,$20,$21,$22) RETURNING *`,
            [product_name, init_name, last_name, product_desc, price, phone_number, ecommerce_phone, product_link, product1.url, product2.url, product3.url, product1.deletehash, product2.deletehash, product3.deletehash, kategori, id_kategori,userId,0,0,pickup,request,googlemaplink]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};



// // Memperbarui produk berdasarkan ID
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { product_name, init_name, last_name, product_desc, price, phone_number, ecommerce_phone, product_link, kategori } = req.body;
    const photos = req.files; // Mendapatkan file gambar dari req.files jika ada

    try {
        // Mencari id_kategori dari tabel categories berdasarkan nama kategori
        const categoryResult = await query(
            `SELECT id_kategori FROM categories WHERE nama_category = $1`,
            [kategori]
        );

        if (categoryResult.rowCount === 0) {
            return res.status(400).json({ message: "Category not found" });
        }

        const id_kategori = categoryResult.rows[0].id_kategori;

        // Mendapatkan data produk lama untuk referensi deletehash
        const oldProductResult = await query(
            `SELECT product1_photo, product2_photo, product3_photo, product1_deletehash, product2_deletehash, product3_deletehash FROM products WHERE id_product = $1`,
            [id]
        );

        if (oldProductResult.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        const oldProduct = oldProductResult.rows[0];

        // Upload setiap foto ke Imgur dan dapatkan URL serta deletehash
        const uploadPhotoToImgur = async (photo) => {
            const form = new FormData();
            form.append('image', fs.createReadStream(photo.path));

            const response = await axios.post('https://api.imgur.com/3/image', form, {
                headers: {
                    Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                    ...form.getHeaders(),
                },
            });
            return {
                url: response.data.data.link,
                deletehash: response.data.data.deletehash
            };
        };

        const deleteImageFromImgur = async (deletehash) => {
            if (deletehash) {
                await axios.delete(`https://api.imgur.com/3/image/${deletehash}`, {
                    headers: { Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}` }
                });
            }
        };

        // Mengganti foto lama dengan foto baru (jika ada)
        const product1 = photos.product1_photo ? await uploadPhotoToImgur(photos.product1_photo[0]) : { url: oldProduct.product1_photo, deletehash: oldProduct.product1_deletehash };
        const product2 = photos.product2_photo ? await uploadPhotoToImgur(photos.product2_photo[0]) : { url: oldProduct.product2_photo, deletehash: oldProduct.product2_deletehash };
        const product3 = photos.product3_photo ? await uploadPhotoToImgur(photos.product3_photo[0]) : { url: oldProduct.product3_photo, deletehash: oldProduct.product3_deletehash };

        // Menghapus foto lama jika digantikan foto baru
        if (photos.product1_photo && oldProduct.product1_deletehash) await deleteImageFromImgur(oldProduct.product1_deletehash);
        if (photos.product2_photo && oldProduct.product2_deletehash) await deleteImageFromImgur(oldProduct.product2_deletehash);
        if (photos.product3_photo && oldProduct.product3_deletehash) await deleteImageFromImgur(oldProduct.product3_deletehash);

        // Hapus file sementara setelah upload
        if (photos.product1_photo) await fsp.unlink(photos.product1_photo[0].path);
        if (photos.product2_photo) await fsp.unlink(photos.product2_photo[0].path);
        if (photos.product3_photo) await fsp.unlink(photos.product3_photo[0].path);

        // Update produk di database
        const result = await query(
            `UPDATE products SET 
                product_name = $2, 
                init_name = $3, 
                last_name = $4,
                product_desc = $5,
                price = $6,
                phone_number = $7,
                ecommerce_phone = $8,
                product_link = $9,
                product1_photo = $10,
                product2_photo = $11,
                product3_photo = $12,
                product1_deletehash = $13,
                product2_deletehash = $14,
                product3_deletehash = $15,
                kategori = $16,
                id_kategori = $17
            WHERE id_product = $1 RETURNING *`,
            [id, product_name, init_name, last_name, product_desc, price, phone_number, ecommerce_phone, product_link, product1.url, product2.url, product3.url, product1.deletehash, product2.deletehash, product3.deletehash, kategori, id_kategori]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};


// Menghapus produk berdasarkan ID
exports.deleteProduct = async (req, res) => {
    const { id } = req.params;

    try {
        // Dapatkan deletehash dari produk
        const product = await query("SELECT product1_deletehash, product2_deletehash, product3_deletehash FROM products WHERE id_product = $1", [id]);

        if (product.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        const { product1_deletehash, product2_deletehash, product3_deletehash } = product.rows[0];

        // Fungsi untuk menghapus gambar dari Imgur menggunakan deletehash
        const deleteImageFromImgur = async (deletehash) => {
            if (!deletehash) return;
            try {
                await axios.delete(`https://api.imgur.com/3/image/${deletehash}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                    },
                });
            } catch (error) {
                console.error(`Failed to delete image from Imgur: ${error.message}`);
            }
        };

        // Hapus semua gambar terkait dari Imgur
        await deleteImageFromImgur(product1_deletehash);
        await deleteImageFromImgur(product2_deletehash);
        await deleteImageFromImgur(product3_deletehash);

        // Hapus produk dari database
        await query("DELETE FROM products WHERE id_product = $1", [id]);

        res.status(200).json({ message: "Product and associated images deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};

exports.savedProduct = async (req, res) => {
    const id_user = req.user.id_user;
    const { id_product } = req.body;

    try {
        // Check if the product is already bookmarked
        const existing = await query(
            `SELECT * FROM saved_product WHERE id_product = $1 AND id_user = $2`,
            [id_product, id_user]
        );

        if (existing.rows.length > 0) {
            // Remove bookmark if it exists
            await query(
                `DELETE FROM saved_product WHERE id_product = $1 AND id_user = $2`,
                [id_product, id_user]
            );
            return res.status(200).json({
                message: 'Product removed from bookmarks',
                isBookmarked: false, // Explicitly return the new bookmark state
            });
        } else {
            // Add bookmark if it doesn't exist
            await query(
                `INSERT INTO saved_product (id_user, id_product) VALUES ($1, $2)`,
                [id_user, id_product]
            );
            return res.status(200).json({
                message: 'Product saved to bookmarks',
                isBookmarked: true, // Explicitly return the new bookmark state
            });
        }
    } catch (error) {
        console.error('Error in savedProduct:', error); // Log the full error
        res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};


exports.getSavedProduct = async (req, res) => {
    const id_user = req.user.id_user;
    try {
        // Fetch saved product IDs for the user
        const savedProducts = await query(
            `SELECT id_product FROM saved_product WHERE id_user = $1`,
            [id_user]
        );

        if (savedProducts.rows.length === 0) {
            return res.status(200).json([]); // No saved products, return empty array
        }

        // Extract product IDs
        const productIds = savedProducts.rows.map((row) => row.id_product);

        // Query products table for all the saved products
        const response = await query(
            `SELECT * FROM products WHERE id_product = ANY($1::uuid[])`,
            [productIds]
        );

        res.status(200).json(response.rows); // Return the products
    } catch (error) {
        console.error('Error in getSavedProduct:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

