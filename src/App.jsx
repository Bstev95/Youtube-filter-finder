import React, { useState } from 'react';

const API_KEY = 'AIzaSyC21oRlWnNmA3MCu799mhMdxnYoxby-Lo4';
const MAX_RESULTS = 50;
const MAX_PAGES = 10;

export default function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('AI');
  const [minViews, setMinViews] = useState(1000);
  const [maxDuration, setMaxDuration] = useState(1200);
  const [maxSubs, setMaxSubs] = useState(15000);
  const [publishWithinDays, setPublishWithinDays] = useState(60);
  const [blacklist, setBlacklist] = useState('');
  const [excludeShorts, setExcludeShorts] = useState(true);
  const [debugStats, setDebugStats] = useState({ total: 0, filtered: 0, passed: 0 });

  const parseISO8601Duration = (d) => {
    const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(match?.[1] || '0');
    const m = parseInt(match?.[2] || '0');
    const s = parseInt(match?.[3] || '0');
    return h * 3600 + m * 60 + s;
  };

  const formatDuration = (sec) => `${Math.floor(sec / 60)}m ${sec % 60}s`;

  const fetchVideos = async () => {
    setLoading(true);
    setVideos([]);
    setDebugStats({ total: 0, filtered: 0, passed: 0 });

    const publishedAfter = new Date(Date.now() - publishWithinDays * 86400000).toISOString();
    const bannedKeywords = blacklist.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);

    let nextPageToken = '';
    let allVideoIds = [];

    try {
      for (let i = 0; i < MAX_PAGES; i++) {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${MAX_RESULTS}&publishedAfter=${publishedAfter}&pageToken=${nextPageToken}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const ids = searchData.items?.map(item => item.id.videoId).filter(Boolean);
        if (!ids.length) break;
        allVideoIds.push(...ids);
        nextPageToken = searchData.nextPageToken;
        if (!nextPageToken) break;
      }

      const chunks = [];
      for (let i = 0; i < allVideoIds.length; i += 50) {
        chunks.push(allVideoIds.slice(i, i + 50));
      }

      let filteredOut = 0;
      const fullVideos = [];

      for (const chunk of chunks) {
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${chunk.join(',')}&part=snippet,statistics,contentDetails`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        const filtered = detailsData.items.filter(video => {
          const views = parseInt(video.statistics.viewCount || '0');
          const duration = parseISO8601Duration(video.contentDetails.duration);
          const title = video.snippet.title.toLowerCase();
          const isBanned = bannedKeywords.some(word => title.includes(word));
          const isShort = duration < 60 || title.includes('#shorts');

          const passed = (
            views >= minViews &&
            duration <= maxDuration &&
            (!excludeShorts || !isShort) &&
            !isBanned
          );

          if (!passed) filteredOut++;
          return passed;
        });

        const enriched = await Promise.all(
          filtered.map(async (video) => {
            const channelId = video.snippet.channelId;
            const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channelId}&part=statistics`);
            const channelData = await channelRes.json();
            const subs = parseInt(channelData.items?.[0]?.statistics?.subscriberCount || '0');
            if (subs > maxSubs) {
              filteredOut++;
              return null;
            }

            return {
              title: video.snippet.title,
              url: `https://www.youtube.com/watch?v=${video.id}`,
              channel: video.snippet.channelTitle,
              views: parseInt(video.statistics.viewCount),
              published: video.snippet.publishedAt,
              duration: formatDuration(parseISO8601Duration(video.contentDetails.duration)),
              subs,
              thumbnail: video.snippet.thumbnails.medium.url,
            };
          })
        );

        fullVideos.push(...enriched.filter(Boolean));
      }

      setDebugStats({ total: allVideoIds.length, filtered: filteredOut, passed: fullVideos.length });
      setVideos(fullVideos);
    } catch (err) {
      console.error('Search failed:', err);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <span role="img" aria-label="camera">🎥</span> YouTube Video Finder
          </h1>
          <p className="text-gray-600">Search YouTube with filters — niche channels, views, duration & more.</p>
        </header>

        <div className="bg-white p-6 rounded-lg shadow-md grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Search Topic</label>
            <input value={query} onChange={e => setQuery(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Min Views</label>
            <input type="number" value={minViews} onChange={e => setMinViews(Number(e.target.value))} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Max Duration (sec)</label>
            <input type="number" value={maxDuration} onChange={e => setMaxDuration(Number(e.target.value))} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Max Subscribers</label>
            <input type="number" value={maxSubs} onChange={e => setMaxSubs(Number(e.target.value))} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Published Within (days)</label>
            <input type="number" value={publishWithinDays} onChange={e => setPublishWithinDays(Number(e.target.value))} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Blacklist Keywords</label>
            <input value={blacklist} onChange={e => setBlacklist(e.target.value)} placeholder="e.g. whatsapp, gaming" className="w-full p-2 border rounded" />
          </div>
          <div className="flex items-center mt-2 col-span-full">
            <input type="checkbox" checked={excludeShorts} onChange={e => setExcludeShorts(e.target.checked)} className="mr-2" />
            <label className="text-sm">Exclude Shorts</label>
          </div>
          <button onClick={fetchVideos} disabled={loading} className="col-span-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition">
            {loading ? 'Searching...' : 'Search Videos'}
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>🔍 Total scanned: {debugStats.total} | Filtered out: {debugStats.filtered} | ✅ Final results: {debugStats.passed}</p>
          {debugStats.passed === 0 && !loading && <p className="text-orange-500 mt-2">⚠️ No videos matched — try loosening filters.</p>}
        </div>

        {/* Monetization Ad Spot */}
        <div className="mt-6 text-center border-t pt-4 text-xs text-gray-500">
          <p>Ad Placeholder – insert AdSense here</p>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {videos.map((v, i) => (
            <div key={i} className="bg-white shadow rounded overflow-hidden">
              <a href={v.url} target="_blank" rel="noopener noreferrer">
                <img src={v.thumbnail} alt={v.title} className="w-full" />
              </a>
              <div className="p-4">
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 block mb-1 hover:underline">
                  {v.title}
                </a>
                <p className="text-sm text-gray-600">📺 {v.channel}</p>
                <p className="text-sm text-gray-600">👁 {v.views.toLocaleString()} views</p>
                <p className="text-sm text-gray-600">⏱ {v.duration}</p>
                <p className="text-sm text-gray-600">👥 {v.subs.toLocaleString()} subs</p>
                <p className="text-sm text-gray-600">📅 {new Date(v.published).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
