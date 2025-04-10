import React, { useState } from 'react';
import axios from 'axios';
import { formatDistanceToNow, parseISO } from 'date-fns';

const App = () => {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`https://yt-search-api.vercel.app/api/search?q=How to ${query}`);
      const items = response.data.videos;

      const filtered = items.filter(video => {
        const views = parseInt(video.views.replace(/[^0-9]/g, '')) || 0;
        const minutes = parseInt(video.duration.seconds) / 60;
        const isRecent = formatDistanceToNow(new Date(video.uploadedAt), { addSuffix: false }).includes('months') ||
                         formatDistanceToNow(new Date(video.uploadedAt), { addSuffix: false }).includes('weeks');
        const isShort = minutes <= 15;
        const hasHowTo = video.title.toLowerCase().startsWith('how to');
        return views >= 40000 && isShort && hasHowTo && isRecent;
      });

      setVideos(filtered.slice(0, 10));
    } catch (err) {
      setError('Failed to fetch videos. Try again later.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">YouTube Video Finder</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="e.g. free ai tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Search
          </button>
        </div>

        {/* 💰 Placeholder for Ad */}
        <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded text-center text-sm shadow-inner">
          🔥 [Ad Placeholder] Promote your course, affiliate tool, or AdSense here!
        </div>

        {loading && <p className="text-center text-gray-500">Searching...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}

        <div className="grid gap-4 mt-4">
          {videos.map((video, index) => (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              key={index}
              className="block border rounded-lg p-4 bg-white shadow hover:shadow-lg transition"
            >
              <div className="flex gap-4">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-32 h-20 object-cover rounded"
                />
                <div>
                  <h2 className="font-semibold text-lg text-blue-700">{video.title}</h2>
                  <p className="text-sm text-gray-600">Views: {video.views}</p>
                  <p className="text-sm text-gray-600">Duration: {video.duration.timestamp}</p>
                  <p className="text-sm text-gray-600">Uploaded: {video.uploadedAt}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
