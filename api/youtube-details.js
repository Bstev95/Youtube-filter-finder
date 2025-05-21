let lastCallTime = 0; // Simple rate limiter (can improve later)

export default async function handler(req, res) {
  // Simple IP-based rate limit (basic protection)
  const now = Date.now();
  if (now - lastCallTime < 3000) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  lastCallTime = now;

  const {
    videoIds = [],
    minViews = 0,
    maxDuration = null,
    blacklist = [],
    excludeShorts = false,
    maxSubs = null
  } = req.body;

  const apiKey = process.env.YT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing YouTube API key in server config.' });
  }

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'No video IDs provided.' });
  }

  try {
    const chunkedIds = videoIds.reduce((acc, id, idx) => {
      const group = Math.floor(idx / 50);
      if (!acc[group]) acc[group] = [];
      acc[group].push(id);
      return acc;
    }, []);

    const allVideos = [];

    for (const chunk of chunkedIds) {
      const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${chunk.join(',')}&part=snippet,statistics,contentDetails`);
      const detailData = await detailRes.json();

      for (const video of detailData.items || []) {
        const views = +video.statistics.viewCount || 0;
        const title = video.snippet.title.toLowerCase();
        const durationSec = parseDuration(video.contentDetails.duration);
        const isShort = durationSec < 60 || title.includes('#shorts');
        const isBlacklisted = blacklist.some(word => title.includes(word.toLowerCase()));

        if (
          views < minViews ||
          (maxDuration && durationSec > +maxDuration) ||
          (excludeShorts && isShort) ||
          isBlacklisted
        ) continue;

        // Get channel info
        const channelId = video.snippet.channelId;
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${apiKey}&id=${channelId}&part=statistics`);
        const channelData = await channelRes.json();
        const subs = +channelData.items?.[0]?.statistics?.subscriberCount || 0;

        if (maxSubs && subs > +maxSubs) continue;

        allVideos.push({
          id: video.id,
          title: video.snippet.title,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          channel: video.snippet.channelTitle,
          views,
          duration: formatDuration(durationSec),
          published: new Date(video.snippet.publishedAt).toLocaleDateString(),
          subs,
          thumbnail: video.snippet.thumbnails.medium.url
        });
      }
    }

    return res.status(200).json(allVideos);
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Failed to fetch video details' });
  }
}

// Duration string → total seconds (e.g. PT4M12S → 252s)
function parseDuration(iso) {
  const match = iso.match(/PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?/);
  const h = +match?.[1] || 0;
  const m = +match?.[2] || 0;
  const s = +match?.[3] || 0;
  return h * 3600 + m * 60 + s;
}

// Seconds → readable format
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
