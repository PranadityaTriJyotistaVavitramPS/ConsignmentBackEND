const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db/index');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const upload = multer({ dest: './UserPhotoProfile' });

// Mendapatkan seluruh user
exports.getAllUsers = async (req, res) => {
    try {
        const result = await query(`SELECT * FROM user_table`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};

// Mendapatkan salah satu user
exports.getUserById = async (req, res) => {
    //console.log("Decoded user from token:", req.user);
    const id  = req.user.id_user;
    try {
        const result = await query(`SELECT * FROM user_table WHERE id_user = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};


exports.login = async (req,res) => {
    const {username, email, password} = req.body;

    try {
        const result = await query (`SELECT * FROM user_table WHERE email = $1 AND username=$2`,[email,username]);
        if(result.rows.length === 0){
            res.status(404).json({message:"No user registered, make sure your gmail or username correct"})
        }
        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password,user.password);

        const payload = { id_user: user.id_user };
        const secretKey = process.env.JWT_SECRET;
        const token = jwt.sign(payload, secretKey);

        if(!isMatch){
            return res.status(401).json({message:"Invalid  email or password"});
        }

        res.status(200).json({status:"sucess", data:{...payload,token}});
        
    } catch (error) {

        console.error(error.message);
        res.status(500).json({ message: "Server error" });
        
    }

}


// Membuat user dengan gambar profil
exports.createUser = async (req, res) => {
    const { username, password, email, birthdate, fulladdress, fullname, phone_number } = req.body;
    const profileImage = req.file;

    console.log("Request body:", req.body);
    console.log("File:", req.file);

    try {
        // Check for duplicate username or email
        const userCheckResult = await query("SELECT * FROM user_table WHERE username = $1", [username]);
        if (userCheckResult.rows.length > 0) {
            return res.status(400).json({ message: "Username already in use" });
        }

        const emailCheckResult = await query("SELECT * FROM user_table WHERE email = $1", [email]);
        if (emailCheckResult.rows.length > 0) {
            return res.status(400).json({ message: "Email already in use" });
        }


        //hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);

        // Upload image to Imgur if there's a profile image
        let profileImageUrl = null;
        let deleteHash = null;

        if (profileImage) {
            try {
                const form = new FormData();
                form.append('image', fs.createReadStream(profileImage.path));

                const response = await axios.post('https://api.imgur.com/3/image', form, {
                    headers: {
                        Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                        ...form.getHeaders(),
                    },
                });
                profileImageUrl = response.data.data.link;
                deleteHash = response.data.data.deletehash;

                // Remove local file after upload
                console.log(profileImage.path);
                fs.unlink(profileImage.path, (err) => {
                    if (err) console.error("Failed to delete local image file:", err.message);
                });
            } catch (imgurError) {
                console.error("Imgur upload error:", imgurError.message);
                return res.status(500).json({ message: "Image upload failed" });
            }
        }

        // Insert user into the database, including profile image URL if available
        const result = await query(
            `INSERT INTO user_table (username, password, email, birthdate, fulladdress, fullname, phone_number, profile_image_url, delete_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [username, hashedPassword, email, birthdate, fulladdress, fullname, phone_number, profileImageUrl, deleteHash]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).send("Server Error");
    }
};

// Middleware for handling file uploads
exports.uploadProfileImage = upload.single('profileImageUrl');



// Mengupdate user berdasarkan ID
exports.updateUser = async (req, res) => {
    const  id  = req.user.id_user;
    const { username, password, email, birthdate, fulladdress, fullname, phone_number } = req.body;
    const profileImage = req.file;

    try {
        // Cek apakah user ada di database
        const userResult = await query('SELECT * FROM user_table WHERE id_user = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedFields ={};

        if (username) updatedFields.username = username;
        if (email) updatedFields.email = email;
        if (birthdate) updatedFields.birthdate = birthdate;
        if (fulladdress) updatedFields.fulladdress = fulladdress;
        if (fullname) updatedFields.fullname = fullname;
        if (phone_number) updatedFields.phone_number = phone_number;

        if (password){
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updatedFields.password = hashedPassword;
        }

        // Inisialisasi variabel untuk URL dan deletehash gambar baru
        let profileImageUrl = userResult.rows[0].profile_image_url;
        let deleteHash = userResult.rows[0].delete_hash;

        // Jika ada gambar baru diunggah, hapus gambar lama dari Imgur dan unggah gambar baru
        if (profileImage) {
            if (deleteHash) {
                // Hapus gambar lama dari Imgur menggunakan deletehash
                try {
                    await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
                        headers: {
                            Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                        },
                    });
                } catch (imgurError) {
                    console.error("Imgur delete error:", imgurError.message);
                }
            }

            // Upload gambar baru ke Imgur
            try {
                const form = new FormData();
                form.append('image', fs.createReadStream(profileImage.path));

                const response = await axios.post('https://api.imgur.com/3/image', form, {
                    headers: {
                        Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                        ...form.getHeaders(),
                    },
                });
                profileImageUrl = response.data.data.link;
                deleteHash = response.data.data.deletehash;

                // Hapus file lokal setelah upload
                fs.unlink(profileImage.path, (err) => {
                    if (err) console.error("Failed to delete local image file:", err.message);
                });
                // Set the new profile image URL
                
                profileImageUrl = imgurResponse.data.data.link;
                updatedFields.profile_image_url = profileImageUrl;

                deleteHash = imgurResponse.data.data.deletehash;
                updatedFields.delete_hash = deleteHash;
            } catch (imgurError) {
                console.error("Imgur upload error:", imgurError.message);
                return res.status(500).json({ message: "Image upload failed" });
            }
        }

        // Update data user di database
        const setFields = Object.keys(updatedFields).map((key,index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(updatedFields);

        const result = await query(
            `UPDATE user_table SET ${setFields} WHERE id_user = $${values.length +1} RETURNING *`,[...values, id]
        )
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).send("Server Error");
    }
};




// Menghapus User berdasarkan ID
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Get the user's delete_hash from the database
        const userResult = await query('SELECT delete_hash FROM user_table WHERE id_user = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const deleteHash = userResult.rows[0].delete_hash;

        // Delete the user from the database
        const result = await query('DELETE FROM user_table WHERE id_user = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // If there is a deleteHash, delete the image from Imgur
        if (deleteHash) {
            try {
                await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                    },
                });
            } catch (imgurError) {
                console.error("Imgur delete error:", imgurError.message);
            }
        }

        res.status(200).json({ message: "User and profile image deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
};

