export function compareSnapshots(currentHtml, archivedHtml) {
  if (!archivedHtml) {
    return { changed: true, reason: "No archive found" };
  }

  // Extract meaningful content from Wikipedia pages
  const extractContent = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Remove Wayback Machine elements first (only in archived version)
    doc.querySelectorAll("#wm-ipp-base, #wm-ipp, #donato, .wb-autocomplete-suggestions").forEach(el => el.remove());
    
    // Focus on the main article content - try multiple selectors
    let content = doc.querySelector("#mw-content-text .mw-parser-output");
    if (!content) content = doc.querySelector("#mw-content-text");
    if (!content) content = doc.querySelector("#bodyContent");
    if (!content) content = doc.querySelector("#content");
    if (!content) return "";

    // Clone to avoid modifying original
    content = content.cloneNode(true);

    // Remove dynamic/non-content elements
    const elementsToRemove = [
      ".mw-editsection", // Edit buttons
      "#coordinates", // Coordinates
      ".navbox", // Navigation boxes
      ".navbox-styles", // Navigation styles
      ".ambox", // Article message boxes
      ".mbox-small", // Small message boxes
      ".sistersitebox", // Sister project boxes
      ".hatnote", // Hat notes
      ".dablink", // Disambiguation links
      ".metadata", // Metadata
      ".infobox", // Infoboxes can change frequently with updates
      "script", // Scripts
      "style", // Styles
      ".reference", // Reference elements
      ".mw-references-wrap", // Reference wrappers
      "#toc", // Table of contents
      ".toc", // Alternative TOC
      "#siteSub", // Site subtitle
      "#contentSub", // Content subtitle
      ".printfooter", // Print footer
      ".catlinks", // Category links
      "noscript", // NoScript tags
      ".mw-jump-link", // Jump links
      "#mw-navigation", // Navigation
      "#footer", // Footer
      ".thumbcaption", // Image captions (change with images)
      ".magnify", // Image magnify links
      "[role='note']", // Notes
      ".error", // Error messages
      ".noprint" // No-print elements
    ];

    elementsToRemove.forEach(selector => {
      content.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Get text content and normalize aggressively
    let text = content.textContent || "";
    
    // Normalize the text heavily
    text = text
      .replace(/\[\d+\]/g, "") // Remove reference numbers [1], [2]
      .replace(/\[edit\]/g, "") // Remove [edit] links
      .replace(/\[citation needed\]/g, "") // Remove citation needed tags
      .replace(/https?:\/\/[^\s]+/g, "") // Remove URLs
      .replace(/[^\w\s.,!?;:()'"-]/g, " ") // Keep only basic punctuation
      .replace(/\s+/g, " ") // Normalize all whitespace to single space
      .replace(/\s([.,!?;:])/g, "$1") // Remove space before punctuation
      .toLowerCase() // Case insensitive
      .trim();

    return text;
  };

  try {
    const currentContent = extractContent(currentHtml);
    const archivedContent = extractContent(archivedHtml);

    console.log("Current content length:", currentContent.length);
    console.log("Archived content length:", archivedContent.length);
    console.log("Current sample:", currentContent.substring(0, 200));
    console.log("Archived sample:", archivedContent.substring(0, 200));

    if (!currentContent || !archivedContent) {
      return { changed: true, reason: "Could not extract content" };
    }

    if (currentContent.length < 100 || archivedContent.length < 100) {
      return { changed: true, reason: "Content too short to analyze" };
    }

    // Use a more sophisticated comparison
    const similarity = calculateSimilarity(currentContent, archivedContent);
    
    // More lenient threshold - Wikipedia pages change legitimately
    const threshold = 0.80; // 80% similar = no significant change
    const changed = similarity < threshold;

    return {
      changed,
      reason: changed 
        ? `Content differs by ${((1 - similarity) * 100).toFixed(1)}%`
        : "Content is essentially the same",
      similarity: (similarity * 100).toFixed(1) + "%",
      diffCount: Math.abs(currentContent.length - archivedContent.length)
    };
  } catch (error) {
    console.error("Error comparing snapshots:", error);
    return { changed: true, reason: "Error during comparison: " + error.message };
  }
}

// Improved similarity calculation using character bigrams
function calculateSimilarity(str1, str2) {
  // For very different lengths, they're probably different
  const maxLen = Math.max(str1.length, str2.length);
  const minLen = Math.min(str1.length, str2.length);
  const lengthRatio = minLen / maxLen;
  
  if (lengthRatio < 0.5) {
    // If one is less than half the length of the other, very different
    return lengthRatio;
  }

  // Use bigram similarity for better accuracy
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  const bigramSimilarity = intersection.size / union.size;
  
  // Weight bigram similarity more heavily
  return (bigramSimilarity * 0.7) + (lengthRatio * 0.3);
}

// Generate character bigrams for comparison
function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}
