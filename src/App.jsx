import React, { useState } from "react";

const API_KEY = "AIzaSyC21oRlWnNmA3MCu799mhMdxnYoxby-Lo4";
const MAX_RESULTS = 50;
const MAX_PAGES = 5;

export default function App() {
  const [query, setQuery] = useState("AI");
  const [minViews, setMinViews] = useState(1000);
  const [maxDuration, setMaxDuration] = useState(1200);
  const [maxSubs, setMaxSubs] = useState(15000);
  const [publishWithinDays, setPublishWithinDays] = useState(60);
  const [blacklist, setBlacklist] = useState("");
  const [excludeShorts, setExcludeShorts] = useState(true);
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
    const bannedWords = blacklist.toLowerCase().split(",").map((x) => x.trim());

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

        // Fetch channel stats
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
          <div>
            <label className="block mb-1 text-sm text-gray-300">Search Topic</label>
            <input className="w-full p-2 rounded bg-gray-800 text-white" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-300">Min Views</label>
            <input type="number" className="w-full p-2 rounded bg-gray-800 text-white" value={minViews} onChange={(e) => setMinViews(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-300">Max Duration (sec)</label>
            <input type="number" className="w-full p-2 rounded bg-gray-800 text-white" value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-300">Max Subscribers</label>
            <input type="number" className="w-full p-2 rounded bg-gray-800 text-white" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-300">Published Within (days)</label>
            <input type="number" className="w-full p-2 rounded bg-gray-800 text-white" value={publishWithinDays} onChange={(e) => setPublishWithinDays(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-300">Blacklist Keywords</label>
            <input className="w-full p-2 rounded bg-gray-800 text-white" placeholder="e.g. whatsapp, gaming" value={blacklist} onChange={(e) => setBlacklist(e.target.value)} />
          </div>
          <div className="col-span-3 flex items-center space-x-2">
            <input type="checkbox" checked={excludeShorts} onChange={(e) => setExcludeShorts(e.target.checked)} />
            <label className="text-gray-300">Exclude Shorts</label>
          </div>
          <div className="col-span-3">
            <button onClick={fetchVideos} disabled={loading} className="bg-purple-600 hover:bg-purple-700 transition px-6 py-2 rounded text-white font-semibold">
              {loading ? "Searching..." : "Search Videos"}
            </button>
          </div>
        </div>

        <div className="text-gray-400 text-sm mb-6">
          Total scanned: {debugStats.total} | Filtered out: {debugStats.filtered} | Final results: {debugStats.passed}
        </div>

        {debugStats.passed === 0 && !loading && (
          <p className="text-orange-400 mb-4">⚠️ No videos matched — try loosening filters.</p>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((v, i) => (
            <a
              key={i}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition"
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
