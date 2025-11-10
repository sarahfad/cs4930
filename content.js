function getPageHTML() {
  return document.documentElement.outerHTML;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "get_page_html") {
    sendResponse({ html: getPageHTML(), url: window.location.href });
  }
});

