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
});
