/**
 * NAMA SCRAPE  :: SSSTIK SCRAPER
 * [•] PEMBUAT  :: DEFAN (dipastebin.web.id)
 * [•] BASIS    :: ssstik.io
 * [•] INTEGRASI:: Cyan Neon REST API
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../../../models/User');

// --- HELPER SCRAPER SSSTIK ---

// 1. Fungsi untuk membuat token acak tt
function generateTT() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// 2. Fungsi untuk ekstraksi data HTML menggunakan RegEx
function extractData(html) {
  const data = {};

  const noWmMatch = html.match(
    /href="(https:\/\/tikcdn\.io\/ssstik\/\d+[^"]+)"\s+class="[^"]*without_watermark[^"]*vignette_active[^"]*"/
  );
  if (noWmMatch) data.video_tanpa_watermark = noWmMatch[1];

  const mp3Match = html.match(
    /href="(https:\/\/tikcdn\.io\/ssstik\/m\/[^"]+)"\s+class="[^"]*music[^"]*"/
  );
  if (mp3Match) data.audio_mp3 = mp3Match[1];

  const captionMatch = html.match(/<p class="maintext">([^<]+)<\/p>/);
  if (captionMatch) data.caption = captionMatch[1];

  const authorMatch = html.match(/<h2>([^<]+)<\/h2>/);
  if (authorMatch) data.author = authorMatch[1];

  return data;
}

// 3. Fungsi Scraper Utama SSSTIK
async function scrapeSsstik(url) {
  try {
    const tt = generateTT();
    
    const params = new URLSearchParams();
    params.append('id', url);
    params.append('locale', 'en');
    params.append('tt', tt);

    const response = await axios.post("https://ssstik.io/abc?url=dl", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "HX-Request": "true",
        "HX-Trigger": "_gcaptcha_pt",
        "HX-Target": "target",
        "HX-Current-URL": "https://ssstik.io/en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 11; Termux) AppleWebKit/537.36",
        "Referer": "https://ssstik.io/en",
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

// --- MIDDLEWARE VALIDASI API KEY & LIMIT USER ---

async function validateApiKey(req, res, next) {
  const apiKey = req.query.apikey || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ 
      status: false, 
      message: 'API Key dibutuhkan! Masukkan parameter ?apikey=' 
    });
  }

  const user = await User.findOne({ apiKey });
  if (!user) {
    return res.status(403).json({ 
      status: false, 
      message: 'API Key tidak valid atau tidak ditemukan.' 
    });
  }

  // Cek limit untuk user ber-plan Free
  if (user.limit <= 0 && user.plan === 'free') {
    return res.status(429).json({ 
      status: false, 
      message: 'Limit request harian kamu sudah habis. Silakan upgrade plan ke Premium/VIP!' 
    });
  }

  // Kurangi limit 1 request jika tipe plan adalah free
  if (user.plan === 'free') {
    user.limit -= 1;
    await user.save();
  }

  req.apiUser = user;
  next();
}

// --- ENDPOINT API GET ---

router.get('/', validateApiKey, async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ 
      status: false, 
      message: "Parameter 'url' wajib diisi. Contoh: ?url=https://vt.tiktok.com/xxxx/&apikey=KEY_KAMU" 
    });
  }

  try {
    const html = await scrapeSsstik(url);
    const hasil = extractData(html);

    if (!hasil.video_tanpa_watermark) {
      return res.status(400).json({ 
        status: false, 
        message: "Gagal mendapatkan link video. Pastikan URL TikTok valid dan publik, lalu coba lagi." 
      });
    }

    return res.json({
      status: true,
      creator: "Cyan Neon API",
      result: {
        author: hasil.author || null,
        caption: hasil.caption || null,
        video_nowm: hasil.video_tanpa_watermark,
        audio_mp3: hasil.audio_mp3 || null
      },
      user: {
        plan: req.apiUser.plan,
        remaining_limit: req.apiUser.limit
      }
    });

  } catch (e) {
    return res.status(500).json({ 
      status: false, 
      message: "Terjadi kesalahan pada server/scraper ssstik.", 
      error: e.message 
    });
  }
});

module.exports = router;
