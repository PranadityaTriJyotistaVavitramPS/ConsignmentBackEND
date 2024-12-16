const { query } = require('../db/index');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const fsp = require('fs').promises;
const { url } = require('inspector');
const upload = multer({ dest: './ServicePhoto' });

//mendapatkan semua servide
exports.getAllService = async (req, res) => {
    try {
        // Query to fetch all fields from the services table and aggregate service types
        const result = await query(`
            SELECT 
                s.*, 
                ARRAY_AGG(st.nama_service_type) AS service_types,
                user_table.profile_image_url,
                user_table.username AS seller_name
            FROM 
                services s
            JOIN
                user_table
            ON
                s.id_user = user_table.id_user
            LEFT JOIN 
                service_service_type sst ON s.id_service = sst.service_id 
            LEFT JOIN 
                service_type st ON sst.service_type_id = st.id_service_type 
            GROUP BY 
                s.id_service, 
                user_table.profile_image_url,
                user_table.username
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching services with types:", error.message);
        res.status(500).send("Server Error");
    }
};

exports.getRandomService = async (req, res) => {
    try {
        // Query to fetch all fields from the services table and aggregate service types
        const result = await query(`
            SELECT 
                s.*, 
                ARRAY_AGG(st.nama_service_type) AS service_types,
                user_table.profile_image_url,
                user_table.username AS seller_name
            FROM 
                services s
            JOIN
                user_table
            ON
                s.id_user = user_table.id_user
            LEFT JOIN 
                service_service_type sst ON s.id_service = sst.service_id 
            LEFT JOIN 
                service_type st ON sst.service_type_id = st.id_service_type 
            GROUP BY 
                s.id_service, 
                user_table.profile_image_url,
                user_table.username                
            ORDER BY
                RANDOM()
            LIMIT 3
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching services with types:", error.message);
        res.status(500).send("Server Error");
    }
};

//mendapatkan salah satu service berdasarkan id

exports.getServiceById = async(req,res) =>{
    const {id_service} = req.params;

    try {
        const result = await query(`
            SELECT 
                s.*,
                ARRAY_AGG(st.nama_service_type) AS service_types,
                user_table.profile_image_url,
                user_table.username AS seller_name 
            FROM 
                services s
            JOIN
                user_table
            ON
                s.id_user = user_table.id_user

            LEFT JOIN 
                service_service_type sst ON s.id_service = sst.service_id 
            LEFT JOIN 
                service_type st ON sst.service_type_id = st.id_service_type               
            WHERE 
                id_service = $1
            GROUP BY 
                s.id_service, 
                user_table.profile_image_url,
                user_table.username  `,[id_service]);
        if (result.rows.length === 0){
            return res.status(404).json({message: "service not found"});
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error.message)
        res.status(500).send("Server Error");   
    }
}

//upload file untuk tabel service
exports.uploadImageServices = upload.fields([
    {name:'service_foto1', maxCount: 1},
    {name:'service_foto2', maxCount: 1},
    {name:'service_foto3', maxCount: 1},
    {name:'service_foto4', maxCount: 1},
    {name:'service_foto5', maxCount: 1}
]);

//membuat suatu service
exports.createService = async (req, res) => {
    console.log("Received req.body:", req.body);
    console.log("Received service_type_names (raw):", req.body.service_type_names);

    // Manually parse `service_type_names` if it's not already an array
    let service_type_names;

    // Ensure service_type_names is an array, even if it's sent as a string
    if (Array.isArray(req.body.service_type_names)) {
        service_type_names = req.body.service_type_names;
    } else if (typeof req.body.service_type_names === 'string') {
        service_type_names = [req.body.service_type_names]; // Convert single string to an array
    } else {
        return res.status(400).json({ message: "Invalid format for service_type_names" });
    }
    
    console.log("Parsed service_type_names:", service_type_names, typeof(service_type_names)); // Should be an array now
    

    const { first_name, last_name, description, starting_price, portfolio_link, instagram_handle, phone_number } = req.body;
    const photos = req.files;
    const userId = req.user.id_user;

    try {
        // Validate service_type_names after parsing
        if (!Array.isArray(service_type_names) || service_type_names.length < 1 || service_type_names.length > 3) {
            return res.status(400).json({ message: "Service must have between 1 and 3 service types" });
        }

        // Find serviceTypeIds based on service_type_names
        const serviceTypeIds = [];
        for (const name_type of service_type_names) {
            const typeResult = await query(
                `SELECT id_service_type FROM service_type WHERE nama_service_type = $1`,
                [name_type]
            );
        
            if (typeResult.rowCount === 0) {
                return res.status(400).json({ message: `Service type '${name_type}' not found` });
            }

            serviceTypeIds.push(typeResult.rows[0].id_service_type);
        }
        console.log("Service Type IDs:", serviceTypeIds); // Ensure only UUIDs are here

        // Upload photos to Imgur
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
                deletehash: response.data.data.deletehash,
            };
        };

        // Upload photos and store URLs and delete hashes
        const service1 = photos.service_foto1 ? await uploadPhotoToImgur(photos.service_foto1[0]) : { url: null, deletehash: null };
        const service2 = photos.service_foto2 ? await uploadPhotoToImgur(photos.service_foto2[0]) : { url: null, deletehash: null };
        const service3 = photos.service_foto3 ? await uploadPhotoToImgur(photos.service_foto3[0]) : { url: null, deletehash: null };
        const service4 = photos.service_foto4 ? await uploadPhotoToImgur(photos.service_foto4[0]) : { url: null, deletehash: null };
        const service5 = photos.service_foto5 ? await uploadPhotoToImgur(photos.service_foto5[0]) : { url: null, deletehash: null };

        // Delete files from temporary folder after upload
        if (photos.service_foto1) await fsp.unlink(photos.service_foto1[0].path);
        if (photos.service_foto2) await fsp.unlink(photos.service_foto2[0].path);
        if (photos.service_foto3) await fsp.unlink(photos.service_foto3[0].path);
        if (photos.service_foto4) await fsp.unlink(photos.service_foto4[0].path);
        if (photos.service_foto5) await fsp.unlink(photos.service_foto5[0].path);

        // Insert service data into the services table
        const result = await query(
            `INSERT INTO services 
            (first_name, last_name, description, starting_price, portfolio_link, instagram_handle, 
            service_foto1, service_foto2, service_foto3, service_foto4, service_foto5,
            deletehash_foto1, deletehash_foto2, deletehash_foto3, deletehash_foto4, deletehash_foto5,id_user,phone_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
            [
                first_name, last_name, description, starting_price, portfolio_link, instagram_handle,
                service1.url, service2.url, service3.url, service4.url, service5.url,
                service1.deletehash, service2.deletehash, service3.deletehash, service4.deletehash, service5.deletehash, userId,phone_number
            ]
        );

        const serviceId = result.rows[0].id_service;

        // Insert service and service_type relationships into service_service_type table
        const serviceTypePromises = serviceTypeIds.map(serviceTypeId => {
            return query(
                `INSERT INTO service_service_type (service_id, service_type_id) VALUES ($1, $2)`,
                [serviceId, serviceTypeId]
            );
        });

        await Promise.all(serviceTypePromises);

        res.status(201).json({ message: 'Service created successfully', serviceId });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Server Error");
    }
};

//update service
exports.updateService = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, description, starting_price, portfolio_link, instagram_handle, service_type_names,phone_number } = req.body;
    const photos = req.files;

    try {
        // Cek apakah service dengan ID yang diberikan ada
        const existingServiceResult = await query(
            `SELECT * FROM services WHERE id_service = $1`,
            [id]
        );

        if (existingServiceResult.rowCount === 0) {
            return res.status(404).json({ message: "Service not found" });
        }

        const existingService = existingServiceResult.rows[0];

        // Validasi dan parsing service_type_names jika disediakan
        let serviceTypeIds = [];
        if (service_type_names) {
            let parsedServiceTypeNames;
            try {
                parsedServiceTypeNames = Array.isArray(service_type_names)
                    ? service_type_names
                    : JSON.parse(service_type_names || '[]');
            } catch (parseError) {
                return res.status(400).json({ message: "Invalid format for service_type_names" });
            }

            if (parsedServiceTypeNames.length > 3) {
                return res.status(400).json({ message: "Service must have between 1 and 3 service types" });
            }

            for (const name_type of parsedServiceTypeNames) {
                const typeResult = await query(
                    `SELECT id_service_type FROM service_type WHERE nama_service_type = $1`,
                    [name_type]
                );
                if (typeResult.rowCount === 0) {
                    return res.status(400).json({ message: `Service type '${name_type}' not found` });
                }
                serviceTypeIds.push(typeResult.rows[0].id_service_type);
            }
        }

        // Fungsi untuk menghapus foto lama dari Imgur
        const deletePhotoFromImgur = async (deletehash) => {
            if (deletehash) {
                try {
                    await axios.delete(`https://api.imgur.com/3/image/${deletehash}`, {
                        headers: {
                            Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                        },
                    });
                    console.log(`Photo with deletehash ${deletehash} deleted from Imgur.`);
                } catch (error) {
                    console.error(`Failed to delete photo from Imgur: ${error.message}`);
                }
            }
        };

        // Fungsi untuk mengunggah foto baru ke Imgur
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
                deletehash: response.data.data.deletehash,
            };
        };

        // Update foto jika ada foto baru
        const updatedPhotos = {};
        if (photos) {
            for (let i = 1; i <= 5; i++) {
                const photoKey = `service_foto${i}`;
                const deletehashKey = `deletehash_foto${i}`;

                if (photos[photoKey]) {
                    // Hapus foto lama dari Imgur
                    await deletePhotoFromImgur(existingService[deletehashKey]);

                    // Upload foto baru ke Imgur
                    const uploadedPhoto = await uploadPhotoToImgur(photos[photoKey][0]);
                    updatedPhotos[photoKey] = uploadedPhoto.url;
                    updatedPhotos[deletehashKey] = uploadedPhoto.deletehash;

                    // Hapus file sementara
                    await fsp.unlink(photos[photoKey][0].path);
                }
            }
        }

        // Bangun query dinamis untuk update
        const fieldsToUpdate = [];
        const valuesToUpdate = [];
        let paramIndex = 1;

        if (first_name) {
            fieldsToUpdate.push(`first_name = $${paramIndex++}`);
            valuesToUpdate.push(first_name);
        }
        if (last_name) {
            fieldsToUpdate.push(`last_name = $${paramIndex++}`);
            valuesToUpdate.push(last_name);
        }
        if (description) {
            fieldsToUpdate.push(`description = $${paramIndex++}`);
            valuesToUpdate.push(description);
        }
        if (starting_price) {
            fieldsToUpdate.push(`starting_price = $${paramIndex++}`);
            valuesToUpdate.push(starting_price);
        }
        if (portfolio_link) {
            fieldsToUpdate.push(`portfolio_link = $${paramIndex++}`);
            valuesToUpdate.push(portfolio_link);
        }
        if (instagram_handle) {
            fieldsToUpdate.push(`instagram_handle = $${paramIndex++}`);
            valuesToUpdate.push(instagram_handle);
        }
        if (phone_number) {
            fieldsToUpdate.push(`phone_number = $${paramIndex++}`);
            valuesToUpdate.push(phone_number);
        }
        for (const [key, value] of Object.entries(updatedPhotos)) {
            fieldsToUpdate.push(`${key} = $${paramIndex++}`);
            valuesToUpdate.push(value);
        }

        // Update service di database
        if (fieldsToUpdate.length > 0) {
            valuesToUpdate.push(id);
            await query(
                `UPDATE services SET ${fieldsToUpdate.join(", ")} WHERE id_service = $${paramIndex}`,
                valuesToUpdate
            );
        }

        // Update hubungan service_type jika ada perubahan
        if (serviceTypeIds.length > 0) {
            // Hapus hubungan lama
            await query(`DELETE FROM service_service_type WHERE service_id = $1`, [id]);

            // Tambahkan hubungan baru
            const serviceTypePromises = serviceTypeIds.map(serviceTypeId => {
                return query(
                    `INSERT INTO service_service_type (service_id, service_type_id) VALUES ($1, $2)`,
                    [id, serviceTypeId]
                );
            });
            await Promise.all(serviceTypePromises);
        }

        res.status(200).json({ message: "Service updated successfully" });
    } catch (error) {
        console.error("Error updating service:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};




//menghapus service
exports.deleteService = async(req,res) =>{
    const { id }= req.params;

    try {
        //mendapatkan deletehash
        const service = await query('SELECT deletehash_foto1, deletehash_foto2, deletehash_foto3, deletehash_foto4, deletehash_foto5 FROM services WHERE id_service = $1',[id]);

        if(service.rowCount === 0){
            return res.status(404).json({message : "Service not found"});
        }

        const { deletehash_foto1, deletehash_foto2, deletehash_foto3, deletehash_foto4, deletehash_foto5 } = service.rows[0];

        const deleteServiceImgur = async( deletehash ) =>{
            if (!deletehash) return;
            try {
                await axios.delete(`https://api.imgur.com/3/image/${deletehash}`,{
                    headers:{
                        Authorization: `Bearer ${process.env.IMGUR_ACCESS_TOKEN}`,
                    },
                });
                
            } catch (error) {
                console.error(`Failed to delete image from Imgur: ${error.message}`);
            }
        }

        await deleteServiceImgur(deletehash_foto1);
        await deleteServiceImgur(deletehash_foto2);
        await deleteServiceImgur(deletehash_foto3);
        await deleteServiceImgur(deletehash_foto4);
        await deleteServiceImgur(deletehash_foto5);

        //hapus service dari tabel relation service_service_type
        await query('DELETE FROM service_service_type WHERE service_id = $1', [id]);


        //hapus service dari tabel service
        await query(`DELETE FROM services WHERE id_service = $1`,[id])
        
        res.status(200).json({ message: "Service and associated images deleted successfully" });
    } catch (error) {
        console.error(error.message)
        res.status(500).send("Server Error")
    }
}