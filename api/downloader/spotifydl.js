const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

const HEADERS = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
};

// =========================
// GET SESSION
// =========================
async function getSession() {
    const response = await axios.get('https://spotmate.online/en1', { headers: HEADERS });
    const $ = cheerio.load(response.data);
    const token = $('meta[name="csrf-token"]').attr('content');
    const cookies = response.headers['set-cookie'] || [];

    return {
        token,
        cookieStr: cookies.map(c => c.split(';')[0]).join('; ')
    };
}

// =========================
// TRACK INFO
// =========================
async function trackData(url, session) {
    const response = await axios.post('https://spotmate.online/getTrackData',
        { spotify_url: url },
        {
            headers: {
                ...HEADERS,
                'content-type': 'application/json',
                'x-csrf-token': session.token,
                'cookie': session.cookieStr,
                'origin': 'https://spotmate.online',
                'referer': 'https://spotmate.online/en1'
            }
        }
    );
    return response.data;
}

// =========================
// CONVERT
// =========================
async function convert(url, session) {
    const response = await axios.post('https://spotmate.online/convert',
        { urls: url },
        {
            headers: {
                ...HEADERS,
                'content-type': 'application/json',
                'x-csrf-token': session.token,
                'cookie': session.cookieStr,
                'origin': 'https://spotmate.online',
                'referer': 'https://spotmate.online/en1'
            }
        }
    );
    return response.data;
}

// =========================
// CHECK TASK
// =========================
async function checkTask(taskId, session) {
    const response = await axios.get(`https://spotmate.online/tasks/${taskId}`, {
        headers: {
            ...HEADERS,
            'x-csrf-token': session.token,
            'cookie': session.cookieStr,
            'origin': 'https://spotmate.online',
            'referer': 'https://spotmate.online/en1'
        }
    });
    return response.data;
}

// =========================
// ENDPOINT GET UTAMA
// =========================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const session = await getSession();
        const trackInfo = await trackData(url, session);

        if (!trackInfo || trackInfo.status === 'error') {
            return res.status(500).json({
                status: false,
                error: 'Failed to get track information'
            });
        }

        const convertInfo = await convert(url, session);
        const image = trackInfo.album?.images?.[0]?.url || '';
        let downloadUrl;

        // Direct URL
        if (convertInfo.error === false && convertInfo.url) {
            downloadUrl = convertInfo.url;
        } 
        // Task processing (Polling)
        else {
            const taskId = convertInfo.task_id || convertInfo.taskid;

            if (!taskId) {
                return res.status(500).json({
                    status: false,
                    error: convertInfo.status || convertInfo.message || 'Failed to start conversion'
                });
            }

            let taskResult;
            do {
                await new Promise(r => setTimeout(r, 3000));
                taskResult = await checkTask(taskId, session);
            } while (
                taskResult &&
                (taskResult.status === 'pending' || taskResult.status === 'processing')
            );

            downloadUrl = taskResult?.url;
        }

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result: {
                title: trackInfo.name || '',
                artist: trackInfo.artists?.[0]?.name || '',
                image,
                download: {
                    url: downloadUrl,
                    headers: {
                        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
                        'referer': 'https://spotmate.online/',
                        'accept': '*/*'
                    },
                    curl: `curl -L "${downloadUrl}" -H "user-agent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36" -H "referer: https://spotmate.online/" -H "accept: */*" --output lagu.mp3`
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.response?.data || error.message
        });
    }
});

module.exports = router;