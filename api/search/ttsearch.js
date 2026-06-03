const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const query = req.query.query?.trim();

        if (!query) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter ?query= wajib diisi",
                example: "/tiktok?query=aesthetic"
            });
        }

        let d = new FormData();
        d.append("keywords", query);
        d.append("count", 15);
        d.append("cursor", 0);
        d.append("web", 1);
        d.append("hd", 1);

        let { data } = await axios.post("https://tikwm.com/api/feed/search", d, {
            headers: {
                ...d.getHeaders()
            }
        });

        if (!data?.data?.videos || data.data.videos.length === 0) {
            return res.status(404).json({
                status: false,
                creator: "Arulzxd",
                message: "Video tidak ditemukan"
            });
        }

        const baseURL = "https://tikwm.com";

        const videos = data.data.videos.map(video => ({
            ...video,
            play: baseURL + video.play,
            wmplay: baseURL + video.wmplay,
            music: baseURL + video.music,
            cover: baseURL + video.cover,
            avatar: baseURL + video.avatar
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
                source: "tikwm-search",
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