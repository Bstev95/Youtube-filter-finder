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

  try {
    // 1. Get video IDs from your own secure endpoint
    let allIds = [];
    let nextPage = '';
    for (let i = 0; i < 3; i++) {
      const params = new URLSearchParams({
        query,
        ...(publishedAfter && { publishedAfter }),
        ...(nextPage && { pageToken: nextPage })
      });

      const res = await fetch(`/api/youtube-search?${params}`);
      const data = await res.json();
      const ids = data.items?.map(item => item.id.videoId).filter(Boolean);
      if (!ids?.length) break;
      allIds.push(...ids);
      nextPage = data.nextPageToken;
      if (!nextPage) break;
    }

    if (!allIds.length) {
      alert('No videos found.');
      setLoading(false);
      return;
    }

    // 2. Send videoIds and filters to filtering endpoint
    const filters = {
      videoIds: allIds,
      minViews: +minViews || 0,
      maxDuration: maxDuration ? +maxDuration : null,
      blacklist: blacklist.toLowerCase().split(',').map(x => x.trim()).filter(Boolean),
      excludeShorts,
      maxSubs: maxSubs ? +maxSubs : null
    };

    const detailsRes = await fetch('/api/youtube-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });

    const filteredVideos = await detailsRes.json();
    setStats({ total: allIds.length, filtered: allIds.length - filteredVideos.length, passed: filteredVideos.length });
    setVideos(filteredVideos);

    if (!filteredVideos.length) {
      alert('No matching videos found. Try loosening your filters.');
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Failed to fetch videos. Please try again.');
  }

  setLoading(false);
};
