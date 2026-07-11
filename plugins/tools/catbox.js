// plugins/Utility/upload-catbox.js
const axios = require("axios");
const FormData = require("form-data");

const CONFIG = {
  endpoint: "https://catbox.moe/user/api.php",
  userhash: "f680aa1e7a60c25f37f855e77" // Isi jika memiliki userhash catbox
};

module.exports = {
  name: "UploadCatbox",
  desc: "Mengunggah raw biner file langsung dari body ke Catbox.moe",
  category: "Utility",
  method: "POST", 
  path: "/upload-catbox",
  params: [], // Tanpa params query
  example: "Kirim data biner file langsung pada body request (Content-Type: application/octet-stream)",

  async run(req, res) {
    try {
      // Mengambil data biner mentah langsung dari body request
      const fileBuffer = req.body;

      // Validasi apakah body berisi buffer yang valid dan tidak kosong
      if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        return res.status(400).json({
          status: false,
          message: "Gagal memproses request. Kirimkan file Anda berupa data biner (raw binary data) langsung di dalam body request.",
          timestamp: new Date().toISOString()
        });
      }

      // Menyiapkan multipart/form-data untuk dikirim ke Catbox
      const body = new FormData();
      body.append("reqtype", "fileupload");

      if (CONFIG.userhash?.trim()) {
        body.append("userhash", CONFIG.userhash);
      }

      // Memasukkan buffer langsung. Karena tanpa params, nama file kita default-kan secara aman
      body.append("fileToUpload", fileBuffer, {
        filename: "upload.bin",
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
