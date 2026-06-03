const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE DOWNLOADER FUNCTION
// ======================================================
async function ytdown(url) {
    const response = await axios.post(
        'https://app.ytdown.to/proxy.php',
        new URLSearchParams({ url: url }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            },
            timeout: 20000
        }
    );

    // Validasi response
    if (!response.data || response.data.api?.status !== 'ok') {
        throw new Error('Failed to fetch data from ytdown');
    }

    const apiData = response.data.api;

    const result = {
        title: apiData.title || '-',
        id: apiData.id || '-',
        thumbnail: apiData.imagePreviewUrl || '-',
        duration: apiData.mediaItems?.[0]?.mediaDuration || '-',
        channel: apiData.userInfo?.name || '-',
        videos: [],
        audios: []
    };

    // Parsing media
    if (Array.isArray(apiData.mediaItems)) {
        apiData.mediaItems.forEach(item => {
            // Video
            if (item.type === 'Video') {
                result.videos.push({
                    resolution: item.mediaRes || 'unknown',
                    quality: item.mediaQuality || '-',
                    size: item.mediaFileSize || '-',
                    ext: item.mediaExtension || 'MP4',
                    url: item.mediaUrl
                });
            }
            // Audio
            else if (item.type === 'Audio') {
                result.audios.push({
                    quality: item.mediaQuality || '-',
                    size: item.mediaFileSize || '-',
                    ext: item.mediaExtension || 'MP3',
                    url: item.mediaUrl
                });
            }
        });
    }

    return result;
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const result = await ytdown(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.response?.data || error.message
        });
    }
});

module.exports = router;