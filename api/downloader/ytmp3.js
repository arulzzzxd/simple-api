const axios = require('axios');
const express = require('express');
const mm = require('music-metadata');
const router = express.Router();

const UA = "Mozilla/5.0 (Linux; Android 13; 23021RAA2Y Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.137 Mobile Safari/537.36";

// ======================================================
// NORMALIZE YOUTUBE URL
// ======================================================
function normalizeUrl(url) {
    try {
        const u = new URL(url);

        if (u.hostname === "youtu.be") {
            return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
        }

        if (u.pathname.includes("/shorts/")) {
            return `https://www.youtube.com/watch?v=${u.pathname.split("/shorts/")[1]?.split("/")[0]}`;
        }

        return `https://www.youtube.com/watch?v=${u.searchParams.get("v")}`;
    } catch {
        return url;
    }
}

// ======================================================
// FORMAT DURATION
// ======================================================
function formatDuration(seconds) {
    seconds = Math.floor(seconds);

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [
        h > 0 ? String(h).padStart(2, "0") : null,
        String(m).padStart(2, "0"),
        String(s).padStart(2, "0")
    ].filter(Boolean).join(":");
}

// ======================================================
// GET REAL MP3 DURATION
// ======================================================
async function getAudioDuration(url) {
    try {
        const response = await axios({
            method: "GET",
            url,
            responseType: "stream",
            headers: {
                "User-Agent": UA
            }
        });

        const metadata = await mm.parseStream(
            response.data,
            null,
            {
                duration: true
            }
        );

        const duration =
            metadata?.format?.duration || 0;

        return formatDuration(duration);

    } catch {
        return null;
    }
}

// ======================================================
// YTMP3
// ======================================================
async function ytmp3(url) {
    const cleanUrl = normalizeUrl(url);
    const videoId = cleanUrl.split("v=")[1];

    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": UA,
        Referer: "https://media.ytmp3.gg/"
    };

    // CHECK DMCA
    const { data: dmca } = await axios.get(
        "https://dmca.ytmp3.gg/api/check",
        {
            params: {
                url: cleanUrl
            },
            headers
        }
    );

    if (dmca.blocked) {
        throw new Error("Video terkena DMCA.");
    }

    // VIDEO INFO
    const { data: info } = await axios.get(
        "https://www.youtube.com/oembed",
        {
            params: {
                url: cleanUrl,
                format: "json"
            },
            headers
        }
    );

    // START CONVERT
    const { data: dl } = await axios.post(
        "https://ytdl.y2mp3.co/api/v2/download",
        {
            url: cleanUrl,
            output: {
                type: "audio",
                format: "mp3",
                quality: "128kbps"
            }
        },
        {
            headers
        }
    );

    if (!dl.statusUrl) {
        throw new Error("Gagal menginisiasi download.");
    }

    let downloadUrl = "";

    // POLLING
    for (let i = 0; i < 60; i++) {
        const { data: result } = await axios.get(
            dl.statusUrl,
            {
                headers
            }
        );

        if (
            result.status === "completed" &&
            result.downloadUrl
        ) {
            downloadUrl = result.downloadUrl;
            break;
        }

        if (
            result.status === "failed" ||
            result.status === "error"
        ) {
            throw new Error("Gagal memproses audio.");
        }

        await new Promise(resolve =>
            setTimeout(resolve, 3000)
        );
    }

    if (!downloadUrl) {
        throw new Error(
            "Timeout saat memproses audio."
        );
    }

    // REAL MP3 DURATION
    const duration =
        await getAudioDuration(downloadUrl);

    return {
        judul: info.title || "-",
        channel: info.author_name || "-",
        duration: duration || "00:00",
        thumbnail:
            info.thumbnail_url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        quality: "MP3 128kbps",
        download: downloadUrl
    };
}

// ======================================================
// ENDPOINT
// ======================================================
router.get("/", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const result = await ytmp3(url);

        res.status(200).json({
            status: true,
            creator: "Arulzxd",
            result
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            error:
                error.response?.data ||
                error.message ||
                String(error)
        });
    }
});

module.exports = router;