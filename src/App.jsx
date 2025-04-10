import React, { useState } from "react";

const API_KEY = "AIzaSyC21oRlWnNmA3MCu799mhMdxnYoxby-Lo4";
const MAX_RESULTS = 50;
const MAX_PAGES = 5;

export default function App() {
  const [query, setQuery] = useState("");
  const [minViews, setMinViews] = useState(0);
  const [maxDuration, setMaxDuration] = useState(3600);
  const [maxSubs, setMaxSubs] = useState(Infinity);
  const [publishWithinDays, setPublishWithinDays] = useState(365);
  const [blacklist, setBlacklist] = useState("");
  const [excludeShorts, setExcludeShorts] = useState(false);
  const [videos, setVideos] = useState([]);
  const [debugStats, setDebugStats] = useState({ total: 0, filtered: 0, passed: 0 });
  const [loading, setLoading] = useState(false);

  const parseDuration = (d) => {
    const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(match?.[1] || "0");
    const m = parseInt(match?.[2] || "0");
    const s = parseInt(match?.[3] || "0");
    return h * 3600 + m * 60 + s;
  };

  const fetchVideos = async () => {
    setLoading(true);
    setVideos([]);
    setDebugStats({ total: 0, filtered: 0, passed: 0 });

    const publishedAfter = new Date(Date.now() - publishWithinDays * 86400000).toISOString();
    const bannedWords = blacklist.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);

    let nextPageToken = "";
    let allVideoIds = [];

    for (let i = 0; i < MAX_PAGES; i++) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&q=${encodeURIComponent(
          query
        )}&part=snippet&type=video&maxResults=${MAX_RESULTS}&publishedAfter=${publishedAfter}&pageToken=${nextPageToken}`
      );
      const searchData = await searchRes.json();
      const ids = searchData.items.map((item) => item.id.videoId);
      allVideoIds.push(...ids);
      if (!searchData.nextPageToken) break;
      nextPageToken = searchData.nextPageToken;
    }

    const chunks = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      chunks.push(allVideoIds.slice(i, i + 50));
    }

    let filteredOut = 0;
    let passed = 0;
    const finalVideos = [];

    for (const chunk of chunks) {
      const videoRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${chunk.join(
          ","
        )}&part=snippet,statistics,contentDetails`
      );
      const videoData = await videoRes.json();

      for (const video of videoData.items) {
        const views = parseInt(video.statistics.viewCount || "0");
        const duration = parseDuration(video.contentDetails.duration);
        const title = video.snippet.title.toLowerCase();
        const isBanned = bannedWords.some((word) => title.includes(word));
        const isShort = duration < 60 || title.includes("#shorts");

        if (
          views < minViews ||
          duration > maxDuration ||
          (excludeShorts && isShort) ||
          isBanned
        ) {
          filteredOut++;
          continue;
        }

        const channelId = video.snippet.channelId;
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channelId}&part=statistics`
        );
        const channelData = await channelRes.json();
        const subs = parseInt(channelData.items?.[0]?.statistics?.subscriberCount || "0");

        if (subs > maxSubs) {
          filteredOut++;
          continue;
        }

        passed++;
        finalVideos.push({
          title: video.snippet.title,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          thumbnail: video.snippet.thumbnails.medium.url,
          views,
          duration,
          subs,
          channel: video.snippet.channelTitle,
          published: video.snippet.publishedAt,
        });
      }
    }

    setDebugStats({ total: allVideoIds.length, filtered: filteredOut, passed });
    setVideos(finalVideos);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans px-4 pb-10">
      <div className="max-w-6xl mx-auto pt-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">🎯 YouTube Video Finder</h1>
        <p className="text-gray-400 mb-8">Search YouTube with filters — niche channels, views, duration & more.</p>

        <div className="bg-gray-900 rounded-xl p-6 grid gap-4 md:grid-cols-3 mb-8">
          <input placeholder="Search topic" className="p-2 rounded bg-gray-800 text-white" value={query} onChange={(e) => setQuery(e.target.value)} />
          <input type="number" placeholder="Min Views" className="p-2 rounded bg-gray-800 text-white" value={minViews} onChange={(e) => setMinViews(Number(e.target.value))} />
          <input type="number" placeholder="Max Duration (sec)" className="p-2 rounded bg-gray-800 text-white" value={maxDuration} onChange={(e) => setMaxDuration(Number(e.target.value))} />
          <input type="number" placeholder="Max Subs" className="p-2 rounded bg-gray-800 text-white" value={maxSubs} onChange={(e) => setMaxSubs(Number(e.target.value))} />
          <input type="number" placeholder="Published Within Days" className="p-2 rounded bg-gray-800 text-white" value={publishWithinDays} onChange={(e) => setPublishWithinDays(Number(e.target.value))} />
          <input placeholder="Blacklist keywords (comma separated)" className="p-2 rounded bg-gray-800 text-white" value={blacklist} onChange={(e) => setBlacklist(e.target.value)} />
          <label className="col-span-3 flex items-center gap-2">
            <input type="checkbox" checked={excludeShorts} onChange={(e) => setExcludeShorts(e.target.checked)} />
            Exclude Shorts
          </label>
          <button onClick={fetchVideos} disabled={loading} className="bg-indigo-600 text-white py-2 rounded col-span-3">
            {loading ? "Searching..." : "Search Videos"}
          </button>
        </div>

        <div className="text-sm text-gray-400 mb-4">
          Total scanned: {debugStats.total} | Filtered out: {debugStats.filtered} | Final results: {debugStats.passed}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((v, i) => (
            <a
              key={i}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 rounded-lg overflow-hidden shadow hover:shadow-2xl transition"
            >
              <img src={v.thumbnail} alt={v.title} className="w-full" />
              <div className="p-4">
                <h2 className="text-lg font-semibold text-purple-400 mb-1">{v.title}</h2>
                <p className="text-sm text-gray-400">📺 {v.channel}</p>
                <p className="text-sm text-gray-400">👁️ {v.views.toLocaleString()} views</p>
                <p className="text-sm text-gray-400">⏱️ {Math.floor(v.duration / 60)}m {v.duration % 60}s</p>
                <p className="text-sm text-gray-400">👥 {v.subs.toLocaleString()} subs</p>
                <p className="text-sm text-gray-400">📅 {new Date(v.published).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

