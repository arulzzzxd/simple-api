// plugins/Utility/upload-catbox.js
const axios = require("axios");
const FormData = require("form-data");

const CONFIG = {
  endpoint: "https://catbox.moe/user/api.php",
  userhash: "f680aa1e7a60c25f37f855e77" // Isi jika memiliki userhash catbox
};

module.exports = {
  name: "UploadCatbox",
  desc: "Mengunggah file dari body multipart/form-data ke Catbox.moe",
  category: "Utility",
  method: "POST", 
  path: "/upload-catbox",
  params: [], 
  example: "Unggah file langsung melalui form-data di dokumentasi API ini",

  async run(req, res) {
    try {
      let fileBuffer = null;
      let fileName = "upload.png";

      // 1. Cek apakah file diparsing oleh middleware uploader bawaan sistem Anda
      if (req.file) {
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname || "upload.png";
      } else if (req.files) {
        // Antisipasi jika menggunakan express-fileupload
        const target = req.files.file || Object.values(req.files)[0];
        const fileObj = Array.isArray(target) ? target[0] : target;
        if (fileObj) {
          fileBuffer = fileObj.data;
          fileName = fileObj.name;
        }
      } 
      
      // 2. Jika middleware uploader tidak ada, extract manual Buffer dari stream req.body
      if (!fileBuffer) {
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
          fileBuffer = req.body;
        } else if (typeof req.body === "object" && req.body !== null) {
          // Jika req.body berupa object biasa karena kepotong parser lain, cari biner di dalamnya
          const values = Object.values(req.body);
          const foundBuffer = values.find(val => Buffer.isBuffer(val));
          if (foundBuffer) fileBuffer = foundBuffer;
        }
      }

      // 3. Jika masih kosong, satukan data stream chunk demi chunk (fallback murni)
      if (!fileBuffer) {
        fileBuffer = await new Promise((resolve) => {
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", () => resolve(null));
        });
      }

      // 4. Validasi hasil akhir pencarian file
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Gagal memproses request. File tidak terdeteksi di dalam body.",
          timestamp: new Date().toISOString()
        });
      }

      // --- SINKRONISASI FORMAT UNTUK CATBOX ---
      // Jika data yang didapat masih berformat mentah multipart (ada header boundary di dalam buffer), 
      // kita bersihkan atau biarkan Catbox mendeteksinya sebagai file stream tunggal.
      const body = new FormData();
      body.append("reqtype", "fileupload");

      if (CONFIG.userhash?.trim()) {
        body.append("userhash", CONFIG.userhash);
      }

      body.append("fileToUpload", fileBuffer, {
        filename: fileName,
        contentType: "application/octet-stream"
      });

      // Proses kirim ke API Catbox
      const response = await axios({
        method: "POST",
        url: CONFIG.endpoint,
        data: body,
        timeout: 120000,
        maxBodyLength: Infinity,
        headers: {
          ...body.getHeaders(),
          "User-Agent": "NodeJS Upload Client"
        }
      });

      const uploaded =
        typeof response.data === "string" &&
        response.data.includes("https://");

      if (!uploaded) {
        return res.status(400).json({
          status: false,
          message: "Gagal mengunggah file ke Catbox",
          raw: response.data,
          timestamp: new Date().toISOString()
        });
      }

      // Response Sukses
      res.json({
        status: true,
        message: "Upload berhasil",
        data: {
          url: response.data.trim()
        },
        metadata: {
          source: "catbox.moe",
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("Upload Catbox Error:", error.message);
      res.status(500).json({
        status: false,
        message: "Terjadi kesalahan pada server saat mengunggah file",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};
