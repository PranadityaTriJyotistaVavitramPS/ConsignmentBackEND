const { query } = require('../db/index');

// Add a new rating
exports.addRating = async (req, res) => {
  try {
    // Ambil parameter dinamis dari URL atau body
    const { id } = req.params; // Dapatkan id dari parameter URL
    const { rating } = req.body; // Ambil rating dari body request
    const id_user = req.user.id_user; // Ambil id_user dari middleware authenticateUser

    if (!id || !rating) {
      return res.status(400).send({ message: "Missing ID or rating value" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).send({ message: "Invalid rating value" });
    }

    await query('BEGIN');

    // Tentukan apakah ID adalah product atau service
    const isProduct = await query('SELECT id_product FROM products WHERE id_product = $1', [id]);
    const isService = await query('SELECT id_service FROM services WHERE id_service = $1', [id]);

    if (!isProduct.rowCount && !isService.rowCount) {
      await query('ROLLBACK');
      return res.status(404).send({ message: "Product or Service not found" });
    }

    // Menentukan jenis (product/service)
    const isProductType = isProduct.rowCount > 0;
    const tableName = isProductType ? 'products' : 'services';
    const idName = isProductType ? 'id_product' : 'id_service';

    // Masukkan rating ke tabel ratings
    await query(
      `INSERT INTO ratings (id_user, ${isProductType ? 'id_product' : 'id_service'}, rating) VALUES ($1, $2, $3)`,
      [id_user, id, rating]
    );

    // Ambil rata-rata rating dan total rating dari tabel terkait
    const result = await query(
      `SELECT avg_rating, total_ratings FROM ${tableName} WHERE ${idName} = $1`,
      [id]
    );

    if (!result.rows.length) {
      await query('ROLLBACK');
      return res.status(404).send({ message: "Product or Service not found" });
    }

    const { avg_rating, total_ratings } = result.rows[0];

    // Hitung nilai rata-rata dan total rating baru
    const new_total_ratings = total_ratings + 1;
    const new_avg_rating = ((avg_rating * total_ratings) + rating) / new_total_ratings;

    // Perbarui tabel produk/layanan dengan rating baru
    await query(
      `UPDATE ${tableName} SET avg_rating = $1, total_ratings = $2 WHERE ${idName} = $3`,
      [new_avg_rating, new_total_ratings, id]
    );

    await query('COMMIT');
    res.status(200).send({ message: "Successfully added rating" });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error adding rating:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


// Update an existing rating
exports.updateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRating = await updateRating(id, req.body);
    res.status(200).json({ success: true, data: updatedRating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a rating
exports.deleteRating = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteRating(id);
    res.status(200).json({ success: true, message: 'Rating deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get ratings
exports.getRatings = async (req, res) => {
  try {
    const ratings = await getRatings();
    res.status(200).json({ success: true, data: ratings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
