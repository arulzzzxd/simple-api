// plugins/Utility/upload-catbox.js
const axios = require("axios");
const FormData = require("form-data");

const CONFIG = {
  endpoint: "https://catbox.moe/user/api.php",
  userhash: "f680aa1e7a60c25f37f855e77" // Isi jika memiliki userhash catbox
};

module.exports = {
  name: "UploadCatbox",
  desc: "Mengunggah file ke Catbox.moe via POST body",
  category: "Utility",
  method: "POST", 
  path: "/upload-catbox",
  params: ["file"],
  example: "Kirim file biner (multipart/form-data) atau raw buffer ke endpoint ini",

  async run(req, res) {
    try {
      // Mengambil file dari req.file (jika Anda pakai multer) atau langsung dari req.body (raw buffer)
      const fileBuffer = req.file?.buffer || req.body;
      const fileName = req.file?.originalname || req.query.filename || "upload.png";

      // Validasi apakah ada file yang dikirim
      if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
        return res.status(400).json({
          status: false,
          message: "Gagal memproses request. Pastikan Anda telah mengirimkan file melalui body request.",
          timestamp: new Date().toISOString()
        });
      }

      const body = new FormData();
      body.append("reqtype", "fileupload");

      if (CONFIG.userhash?.trim()) {
        body.append("userhash", CONFIG.userhash);
      }

      // Memasukkan buffer file langsung ke FormData
      body.append("fileToUpload", fileBuffer, {
        filename: fileName
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
          filename: fileName,
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
