import React, { useState } from 'react';

const App = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    if (!search.trim()) return;

    // Temporary mock result
    const mockVideos = [
      {
        title: 'How to use Notion for Productivity',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      {
        title: 'How to automate tasks with ChatGPT',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ];

    setResults(mockVideos);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-xl w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">YouTube Video Finder</h1>
        <p className="text-gray-600 mb-6">Search videos with your custom filters</p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="e.g. How to use Notion for productivity"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Search
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((video, index) => (
              <a
                key={index}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <h2 className="text-md font-semibold text-blue-700">{video.title}</h2>
                <p className="text-sm text-gray-500">{video.url}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

