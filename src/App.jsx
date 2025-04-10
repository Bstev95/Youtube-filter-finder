import React, { useState } from 'react';

const App = () => {
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-xl w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">YouTube Video Finder</h1>
        <p className="text-gray-600 mb-6">Search videos with your custom filters</p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. How to use Notion for productivity"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
