const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

// ======================================================
// UTILITY / HELPER FUNCTIONS
// ======================================================
function parseFileSize(size) {
    return parseFloat(size) * (/GB/i.test(size)
        ? 1000000
        : /MB/i.test(size)
            ? 1000
            : /KB/i.test(size)
                ? 1
                : /bytes?/i.test(size)
                    ? 0.001
                    : /B/i.test(size)
                        ? 0.1
                        : 0);
}

// ======================================================
// CORE MEDIAFIRE DOWNLOADER FUNCTION
// ======================================================
async function mediafireDl(url) {
    if (!/https?:\/\/(www\.)?mediafire\.com/.test(url)) {
        throw new Error('URL yang dimasukkan bukan link MediaFire yang valid!');
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);

        const downloadUrl = ($('#downloadButton').attr('href') || '').trim();
        const alternativeUrl = ($('#download_link > a.retry').attr('href') || '').trim();
        
        const $intro = $('div.dl-info > div.intro');
        const filename = $intro.find('div.filename').text().trim();
        const filetype = $intro.find('div.filetype > span').eq(0).text().trim();
        
        // Ekstraksi ekstensi file secara aman menggunakan regex
        const extMatch = /\(\.(.*?)\)/.exec($intro.find('div.filetype > span').eq(1).text());
        const ext = extMatch ? extMatch[1].trim() : 'bin';

        const $li = $('div.dl-info > ul.details > li');
        const uploadDate = $li.eq(1).find('span').text().trim();
        const filesize = $li.eq(0).find('span').text().trim();
        const filesizeB = parseFileSize(filesize);

        if (!downloadUrl && !alternativeUrl) {
            throw new Error('Gagal mendapatkan link unduhan. File mungkin sudah dihapus atau diblokir.');
        }

        return {
            url: downloadUrl || alternativeUrl,
            url2: alternativeUrl,
            filename,
            filetype,
            ext,
            upload_date: uploadDate,
            filesize,
            filesizeB
        };
    } catch (error) {
        throw new Error(error.message || 'Gagal mengambil data dari MediaFire');
    }
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'url' wajib diisi! Contoh: ?url=https://www.mediafire.com/file/..."
        });
    }

    try {
        const result = await mediafireDl(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'MediaFire Downloader',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal memproses link MediaFire',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;