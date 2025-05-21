export default async function handler(req, res) {
  const {
    videoIds = [],
    minViews = 0,
    maxDuration = null,
    blacklist = [],
    excludeShorts = false,
    maxSubs = null
  } = req.body;

  const apiKey = process.env.YT_API_KEY;

  try {
    const chunkedIds = Array.isArray(videoIds)
      ? videoIds.reduce((acc, id, idx) => {
          const group = Math.floor(idx / 50);
          if (!acc[group]) acc[group] = [];
          acc[group].push(id);
          return acc;
        }, [])
      : [];

    const allVideos = [];

    for (const chunk of chunkedIds) {
      const detailRes = await fetch(https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${chunk.join(',')}&part=snippet,statistics,contentDetails);
      const detailData = await detailRes.json();

      for (const video of detailData.items) {
        const views = +video.statistics.viewCount || 0;
        const title = video.snippet.title.toLowerCase();
        const duration = parseDuration(video.contentDetails.duration);
        const isShort = duration < 60 || title.includes('#shorts');
        const isBlacklisted = blacklist.some(word => title.includes(word));

        if (
          views < minViews ||
          (maxDuration && duration > +maxDuration) ||
          (excludeShorts && isShort) ||
          isBlacklisted
        ) continue;

        const channelId = video.snippet.channelId;
        const channelRes = await fetch(https://www.googleapis.com/youtube/v3/channels?key=${apiKey}&id=${channelId}&part=statistics);
        const channelData = await channelRes.json();
        const subs = +channelData.items?.[0]?.statistics?.subscriberCount || 0;

        if (maxSubs && subs > +maxSubs) continue;

        allVideos.push({
          id: video.id,
          title: video.snippet.title,
          url: https://www.youtube.com/watch?v=${video.id},
          channel: video.snippet.channelTitle,
          views,
          duration: formatDuration(duration),
          published: new Date(video.snippet.publishedAt).toLocaleDateString(),
          subs,
          thumbnail: video.snippet.thumbnails.medium.url
        });
      }
    }

    res.status(200).json(allVideos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

// Helper functions
function parseDuration(d) {
  const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = +match?.[1] || 0, m = +match?.[2] || 0, s = +match?.[3] || 0;
  return h * 3600 + m * 60 + s;
}

function formatDuration(seconds) {
  return ${Math.floor(seconds / 60)}m ${seconds % 60}s;
}
