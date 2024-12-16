require("dotenv").config();
const express = require("express");
const db = require("./db");

const app = express();

app.use(express.json());


//buat produk
app.post("/api/v1/products",async(req,res) => {

    try {
        const {nama_produk,deskripsi_produk,harga,nomor_telepon,link_website,jenis_produk,foto_1,foto_2,foto_3}= req.body;
        const buat_produk= await db.query("INSERT INTO tabel_produk (nama_produk,deskripsi_produk,harga,nomor_telepon,link_website,jenis_produk,foto_1,foto_2,foto_3) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING*",[nama_produk,deskripsi_produk,harga,nomor_telepon,link_website,jenis_produk,foto_1,foto_2,foto_3]);
        res.status(201).json({
            data:{
                produk:buat_produk.rows
            }
        });

    } catch (err) {
        console.error(err.message);
    }   
});

//semua produk
app.get("/api/v1/products", async(req,res) =>{

    try {
        const result_all_product = await db.query("SELECT * FROM tabel_produk")
        res.status(200).json({
            status:"success",
            data:{
                produk:result_all_product.rows
            }
        })
        
    } catch (err) {
        console.error(err.message)
    }
});

//salah satu produk
app.get("/api/v1/products/:id", async(req,res)=>{

    try {
        const {id} = req.params;
        const result_one_product = await db.query("SELECT * FROM tabel_produk WHERE id_produk= $1",[id]);

        res.status(200).json({
            status:"success",
            data:{
                produk:result_one_product.rows
            }
        })  
    } catch (err) {
        console.error(err.message);
        
    }
});

//hapus produk 
app.delete("/api/v1/products/:id",async(req,res)=>{
    try {
        const{id} =req.params;
        const del_product= await db.query("DELETE FROM tabel_produk WHERE id_produk = $1",[id]);

        res.status(200).json({
            data:"delete"
        })
        
    } catch (err) {
        console.error(err.message)
        
    }

});

//update produk
app.put("/api/v1/products/:id", async(req,res)=>{

    try {
        const{id}=req.params;
        const{nama_produk,deskripsi_produk,harga,nomor_telepon,link_website,jenis_produk,foto_1,foto_2,foto_3}=req.body;
        const update_produk= await db.query("UPDATE tabel_produk SET nama_produk =$1,deskripsi_produk=$2,harga=$3,nomor_telepon=$4,link_website=$5,jenis_produk=$6,foto_1=$7,foto_2=$8,foto_3=$9 WHERE id_produk = $10",[nama_produk,deskripsi_produk,harga,nomor_telepon,link_website,jenis_produk,foto_1,foto_2,foto_3,id]);
        res.status(201).json({
            status:"success",
            data:{
                produk:"updated"
            }
        })
        
    } catch (err) {
        console.error(err.message)
    }
});




const port = process.env.PORT||3006
app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
});