chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fetch_wayback") {
    (async () => {
      try {
        const url = `https://archive.org/wayback/available?url=${encodeURIComponent(msg.url)}`;
        const res = await fetch(url);
        const data = await res.json();
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
  
  if (msg.action === "fetch_snapshots") {
    (async () => {
      try {
        // Use CDX API to get available snapshots
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(msg.url)}&output=json&collapse=timestamp:8&limit=200`;
        const res = await fetch(cdxUrl);
        const data = await res.json();
        
        // First row is headers, skip it. Extract timestamps (format: YYYYMMDDHHmmss)
        const snapshots = [];
        if (data && data.length > 1) {
          for (let i = 1; i < data.length; i++) {
            if (data[i] && data[i][1]) {
              const timestamp = data[i][1];
              const date = parseTimestamp(timestamp);
              snapshots.push({
                timestamp: timestamp,
                date: date.dateString,
                dateFormatted: date.formatted,
                url: `https://web.archive.org/web/${timestamp}/${msg.url}`
              });
            }
          }
        }
        
        // Sort by date descending (newest first)
        snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        sendResponse({ success: true, snapshots });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
  
  if (msg.action === "fetch_archived_html") {
    (async () => {
      try {
        // Force HTTPS to avoid CORS issues
        let url = msg.url;
        if (url.startsWith("http://")) {
          url = url.replace("http://", "https://");
        }
        
        const res = await fetch(url);
        const html = await res.text();
        sendResponse({ success: true, html });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
  
  if (msg.action === "fetch_archived_by_date") {
    (async () => {
      try {
        // Build URL for specific timestamp
        const archivedUrl = `https://web.archive.org/web/${msg.timestamp}/${msg.url}`;
        const res = await fetch(archivedUrl);
        const html = await res.text();
        sendResponse({ success: true, html, url: archivedUrl });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});

// Helper function to parse Wayback timestamp (YYYYMMDDHHmmss)
function parseTimestamp(timestamp) {
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  const hour = timestamp.substring(8, 10);
  const minute = timestamp.substring(10, 12);
  
  const date = new Date(year, month - 1, day, hour, minute);
  const dateString = `${year}-${month}-${day}`;
  const formatted = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return { date, dateString, formatted };
}
