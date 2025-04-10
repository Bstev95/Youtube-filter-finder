import React, { useState } from "react";

const API_KEY = "AIzaSyC21oRlWnNmA3MCu799mhMdxnYoxby-Lo4";
const MAX_RESULTS = 50;
const MAX_PAGES = 100;

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
  const [recentSearches, setRecentSearches] = useState([]);

  const parseDuration = (d) => {
    const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(match?.[1] || "0");
    const m = parseInt(match?.[2] || "0");
    const s = parseInt(match?.[3] || "0");
    return h * 3600 + m * 60 + s;
  };

  const clearFilters = () => {
    setQuery("");
    setMinViews(0);
    setMaxDuration(3600);
    setMaxSubs(Infinity);
    setPublishWithinDays(365);
    setBlacklist("");
    setExcludeShorts(false);
  };

  const exportToCSV = () => {
    const csv = [
      ["Title", "Channel", "Views", "Duration", "Subscribers", "Published", "URL"],
      ...videos.map(v => [v.title, v.channel, v.views, v.duration, v.subs, new Date(v.published).toLocaleDateString(), v.url])
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_results.csv";
    a.click();
  };

  const fetchVideos = async () => {
    if (!query.trim()) return alert("Please enter a search topic.");

    setLoading(true);
    setVideos([]);
    setDebugStats({ total: 0, filtered: 0, passed: 0 });
    setRecentSearches(prev => [query, ...prev.filter(q => q !== query)].slice(0, 5));

    try {
      const publishedAfter = new Date(Date.now() - publishWithinDays * 86400000).toISOString();
      const bannedWords = blacklist.toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      let allVideoIds = [], nextPageToken = "";

      for (let i = 0; i < MAX_PAGES; i++) {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${MAX_RESULTS}&publishedAfter=${publishedAfter}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (!data.items) break;
        const ids = data.items.map(i => i.id.videoId).filter(Boolean);
        allVideoIds.push(...ids);
        if (!data.nextPageToken) break;
        nextPageToken = data.nextPageToken;
      }

      if (allVideoIds.length === 0) throw new Error("No video results.");

      let finalVideos = [];
      let filteredOut = 0;

      for (let i = 0; i < allVideoIds.length; i += 50) {
        const chunk = allVideoIds.slice(i, i + 50);
        const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${chunk.join(",")}&part=snippet,statistics,contentDetails`);
        const detailsData = await detailsRes.json();

        const filtered = await Promise.all(
          detailsData.items.map(async (video) => {
            const title = video.snippet.title.toLowerCase();
            const duration = parseDuration(video.contentDetails.duration);
            const views = parseInt(video.statistics.viewCount || "0");
            const isShort = duration < 60 || title.includes("#shorts");
            const isBanned = bannedWords.some(w => title.includes(w));

            if (
              views < minViews ||
              duration > maxDuration ||
              (excludeShorts && isShort) ||
              isBanned
            ) {
              filteredOut++;
              return null;
            }

            const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${video.snippet.channelId}&part=statistics`);
            const channelData = await channelRes.json();
            const subs = parseInt(channelData.items?.[0]?.statistics?.subscriberCount || "0");
            if (subs > maxSubs) {
              filteredOut++;
              return null;
            }

            return {
              title: video.snippet.title,
              url: `https://www.youtube.com/watch?v=${video.id}`,
              thumbnail: video.snippet.thumbnails.medium.url,
              views,
              duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
              subs,
              channel: video.snippet.channelTitle,
              published: video.snippet.publishedAt,
            };
          })
        );

        finalVideos.push(...filtered.filter(Boolean));
      }

      setDebugStats({ total: allVideoIds.length, filtered: filteredOut, passed: finalVideos.length });
      setVideos(finalVideos);
    } catch (err) {
      alert("Error fetching videos: " + err.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans px-4 pb-10">
      <header className="bg-gray-950 py-6 text-center shadow-md mb-8">
        <h1 className="text-3xl font-bold tracking-tight">📺 YouTube Benchmark Tool</h1>
        <p className="text-gray-400 text-sm">Discover high-performing, niche YouTube content</p>
        {recentSearches.length > 0 && (
          <div className="mt-2 text-gray-400 text-xs">Recent: {recentSearches.map((s, i) => (
            <button key={i} className="underline text-indigo-400 ml-2" onClick={() => setQuery(s)}>{s}</button>
          ))}</div>
        )}
      </header>

      {/* Filter section and buttons would go here... */}
      {/* Videos display and footer would go here... */}

    </div>
  );
}
