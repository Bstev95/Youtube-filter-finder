import React, { useState } from 'react';

const API_KEY = 'YOUR_API_KEY_HERE';
const MAX_RESULTS = 50;
const MAX_PAGES = 10;

export default function App() {
  const [query, setQuery] = useState('');
  const [minViews, setMinViews] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [publishWithinDays, setPublishWithinDays] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [excludeShorts, setExcludeShorts] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, filtered: 0, passed: 0 });

  const parseDuration = (d) => {
    const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = +match?.[1] || 0, m = +match?.[2] || 0, s = +match?.[3] || 0;
    return h * 3600 + m * 60 + s;
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const fetchVideos = async () => {
    if (!query.trim()) {
      alert('Please enter a search topic.');
      return;
    }

    setLoading(true);
    setVideos([]);
    setStats({ total: 0, filtered: 0, passed: 0 });

    const publishedAfter = publishWithinDays
      ? new Date(Date.now() - +publishWithinDays * 86400000).toISOString()
      : undefined;

    const bannedWords = blacklist.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    let allIds = [], nextPage = '', filteredOut = 0, fullVideos = [];

    try {
      for (let i = 0; i < MAX_PAGES; i++) {
        const params = new URLSearchParams({
          key: API_KEY,
          q: query,
          part: 'snippet',
          type: 'video',
          maxResults: MAX_RESULTS,
          ...(publishedAfter && { publishedAfter }),
          ...(nextPage && { pageToken: nextPage })
        });

        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        const data = await res.json();
        const ids = data.items?.map(item => item.id.videoId).filter(Boolean);
        if (!ids?.length) break;

        allIds.push(...ids);
        nextPage = data.nextPageToken;
        if (!nextPage) break;
      }

      for (let i = 0; i < allIds.length; i += 50) {
        const chunk = allIds.slice(i, i + 50);
        const detailsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${chunk.join(',')}&part=snippet,statistics,contentDetails`
        );
        const details = await detailsRes.json();

        const validVideos = await Promise.all(details.items.map(async (video) => {
          const views = +video.statistics.viewCount || 0;
          const duration = parseDuration(video.contentDetails.duration);
          const title = video.snippet.title.toLowerCase();
          const isShort = duration < 60 || title.includes('#shorts');
          const isBlacklisted = bannedWords.some(word => title.includes(word));

          let passed = true;
          if (minViews && views < +minViews) passed = false;
          if (maxDuration && duration > +maxDuration) passed = false;
          if (excludeShorts && isShort) passed = false;
          if (isBlacklisted) passed = false;

          if (!passed) {
            filteredOut++;
            return null;
          }

          const channelId = video.snippet.channelId;
          const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channelId}&part=statistics`);
          const channelData = await channelRes.json();
          const subs = +channelData.items?.[0]?.statistics?.subscriberCount || 0;

          if (maxSubs && subs > +maxSubs) {
            filteredOut++;
            return null;
          }

          return {
            title: video.snippet.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            channel: video.snippet.channelTitle,
            views,
            duration: formatDuration(duration),
            published: new Date(video.snippet.publishedAt).toLocaleDateString(),
            subs,
            thumbnail: video.snippet.thumbnails.medium.url,
          };
        }));

        fullVideos.push(...validVideos.filter(Boolean));
      }

      setStats({ total: allIds.length, filtered: filteredOut, passed: fullVideos.length });
      setVideos(fullVideos);

      if (fullVideos.length === 0) {
        alert('No matching videos found. Try loosening your filters.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching videos. Check your API key or try again later.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎥 YouTube Video Finder</h1>
        <p className="mb-6 text-gray-400">Search with filters — niche channels, views, duration & more.</p>

        <div className="bg-gray-800 p-6 rounded-xl mb-8 grid md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 text-sm">Search Topic</label>
            <input value={query} onChange={e => setQuery(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div>
            <label className="block mb-1 text-sm">Minimum Views</label>
            <input value={minViews} onChange={e => setMinViews(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div>
            <label className="block mb-1 text-sm">Max Duration (sec)</label>
            <input value={maxDuration} onChange={e => setMaxDuration(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div>
            <label className="block mb-1 text-sm">Max Subscribers</label>
            <input value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div>
            <label className="block mb-1 text-sm">Published Within (days)</label>
            <input value={publishWithinDays} onChange={e => setPublishWithinDays(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div>
            <label className="block mb-1 text-sm">Exclude Keywords</label>
            <input value={blacklist} onChange={e => setBlacklist(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600" />
          </div>
          <div className="col-span-3 flex items-center gap-2 mt-2">
            <input type="checkbox" checked={excludeShorts} onChange={e => setExcludeShorts(e.target.checked)} />
            <label>Exclude Shorts</label>
          </div>
          <div className="col-span-3 mt-4">
            <button onClick={fetchVideos} disabled={loading} className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Searching...' : 'Search Videos'}
            </button>
          </div>
        </div>

        <div className="text-gray-400 text-sm mb-4">
          Scanned: {stats.total} | Filtered: {stats.filtered} | Final: {stats.passed}
        </div>

        {videos.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {videos.map((v, i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden">
                <a href={v.url} target="_blank" rel="noopener noreferrer">
                  <img src={v.thumbnail} alt={v.title} />
                </a>
                <div className="p-4">
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 font-semibold hover:underline">{v.title}</a>
                  <p className="text-sm mt-2">📺 {v.channel}</p>
                  <p className="text-sm">👁️ {v.views.toLocaleString()} views</p>
                  <p className="text-sm">⏱️ {v.duration}</p>
                  <p className="text-sm">👥 {v.subs.toLocaleString()} subs</p>
                  <p className="text-sm">📅 {v.published}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
