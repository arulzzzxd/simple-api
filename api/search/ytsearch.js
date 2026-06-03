const express = require("express");
const yts = require("yt-search");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const query = req.query.query?.trim();

        if (!query) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter ?query= wajib diisi",
                example: "/youtube?query=alan walker"
            });
        }

        const search = await yts(query);

        if (!search.videos || search.videos.length === 0) {
            return res.status(404).json({
                status: false,
                creator: "Arulzxd",
                message: "Video tidak ditemukan"
            });
        }

        const videos = search.videos.slice(0, 5).map(video => ({
            title: video.title,
            videoId: video.videoId,
            duration: video.timestamp,
            views: video.views,
            uploaded: video.ago,
            url: video.url,
            thumbnail: video.thumbnail,
            author: video.author?.name || "Unknown"
        }));

        return res.status(200).json({
            status: true,
            creator: "Arulzxd",
            result: {
                query,
                total: videos.length,
                videos
            },
            metadata: {
                source: "yt-search",
                timestamp: new Date().toISOString()
            }
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Terjadi kesalahan saat mencari video",
            error: err.message
        });
    }
});

module.exports = router;