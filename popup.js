import { compareSnapshots } from "./compareSnapshots.js";

document.getElementById("analyze").addEventListener("click", async () => {
  const resultBox = document.getElementById("result");
  resultBox.innerText = "Analyzing...";
  resultBox.style.color = "blue";

  try {
    // Step 1: Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("wikipedia.org")) {
      resultBox.innerText = "⚠️ Please visit a Wikipedia page first.";
      resultBox.style.color = "orange";
      return;
    }

    console.log("Analyzing tab:", tab.url);

    // Step 2: Get current page HTML from content script
    const current = await chrome.tabs.sendMessage(tab.id, { action: "get_page_html" });
    console.log("Current page HTML length:", current.html?.length || 0);

    // Step 3: Fetch Wayback Machine info via background script
    const archiveInfo = await chrome.runtime.sendMessage({
      action: "fetch_wayback",
      url: current.url
    });

    if (!archiveInfo.success) {
      throw new Error("Failed to fetch Wayback data: " + archiveInfo.error);
    }

    console.log("Wayback API response:", archiveInfo.data);

    const archivedUrl = archiveInfo.data?.archived_snapshots?.closest?.url;
    let archivedHtml = null;

    if (archivedUrl) {
      console.log("Archived snapshot found:", archivedUrl);
      
      // Step 4: Fetch archived HTML via background script (to avoid CORS)
      const archivedData = await chrome.runtime.sendMessage({
        action: "fetch_archived_html",
        url: archivedUrl
      });

      if (!archivedData.success) {
        throw new Error("Failed to fetch archived HTML: " + archivedData.error);
      }

      archivedHtml = archivedData.html;
      console.log("Archived HTML length:", archivedHtml.length);
    } else {
      console.warn("⚠️ No archived snapshot found for this page.");
      resultBox.innerText = "No archived version found in Wayback Machine.";
      resultBox.style.color = "orange";
      return;
    }

    // Step 5: Compare snapshots
    const result = compareSnapshots(current.html, archivedHtml);

    // Step 6: Display result
    if (result.changed) {
      resultBox.innerHTML = `
        <strong style="color: red;">⚠️ Changes Detected</strong><br>
        ${result.reason}<br>
        <small>Differences: ${result.diffCount || 'multiple'}</small>
      `;
    } else {
      resultBox.innerHTML = `
        <strong style="color: green;">✓ No Significant Changes</strong><br>
        <small>${result.reason}</small>
      `;
    }
  } catch (error) {
    console.error("Error in analysis:", error);
    resultBox.innerText = `❌ Error: ${error.message}`;
    resultBox.style.color = "red";
  }
});
