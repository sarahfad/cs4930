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

    // Calculate word-level diff
    const wordDiff = calculateWordDiff(currentContent, archivedContent);
    
    return {
      changed,
      reason: changed 
        ? `Content differs by ${((1 - similarity) * 100).toFixed(1)}%`
        : "Content is essentially the same",
      similarity: (similarity * 100).toFixed(1) + "%",
      diffCount: Math.abs(currentContent.length - archivedContent.length),
      wordDiff: wordDiff,
      currentText: currentContent,
      archivedText: archivedContent
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

// Calculate word-level diff - returns grouped chunks for better visualization
function calculateWordDiff(text1, text2) {
  const words1 = text1.split(/\s+/).filter(w => w.length > 0);
  const words2 = text2.split(/\s+/).filter(w => w.length > 0);
  
  // Use a greedy diff algorithm for better performance
  const diff = [];
  let i = 0, j = 0;
  
  while (i < words1.length || j < words2.length) {
    // Try to find the next matching word
    if (i < words1.length && j < words2.length && words1[i] === words2[j]) {
      // Words match - add as unchanged
      diff.push({ type: 'unchanged', text: words1[i] });
      i++;
      j++;
    } else {
      // Look ahead to find next common word
      let foundMatch = false;
      let lookahead = 1;
      const maxLookahead = Math.min(50, Math.max(words1.length - i, words2.length - j));
      
      // Try to find where sequences align again
      while (lookahead <= maxLookahead && !foundMatch) {
        // Check if removing words from text1 helps
        if (i + lookahead < words1.length && 
            j < words2.length && 
            words1[i + lookahead] === words2[j]) {
          // Remove words from text1
          for (let k = 0; k < lookahead; k++) {
            diff.push({ type: 'removed', text: words1[i + k] });
          }
          i += lookahead;
          foundMatch = true;
        }
        // Check if adding words from text2 helps
        else if (i < words1.length && 
                 j + lookahead < words2.length && 
                 words1[i] === words2[j + lookahead]) {
          // Add words from text2
          for (let k = 0; k < lookahead; k++) {
            diff.push({ type: 'added', text: words2[j + k] });
          }
          j += lookahead;
          foundMatch = true;
        }
        lookahead++;
      }
      
      // If no match found, treat as change
      if (!foundMatch) {
        if (i < words1.length && j < words2.length) {
          // Replace
          diff.push({ type: 'removed', text: words1[i] });
          diff.push({ type: 'added', text: words2[j] });
          i++;
          j++;
        } else if (i < words1.length) {
          diff.push({ type: 'removed', text: words1[i] });
          i++;
        } else if (j < words2.length) {
          diff.push({ type: 'added', text: words2[j] });
          j++;
        }
      }
    }
  }
  
  // Group consecutive chunks of same type for better visualization
  return groupDiffChunks(diff);
}

// Group consecutive diff chunks of the same type
function groupDiffChunks(diff) {
  if (diff.length === 0) return [];
  
  const grouped = [];
  let currentChunk = { type: diff[0].type, words: [] };
  
  for (const item of diff) {
    if (item.type === currentChunk.type) {
      currentChunk.words.push(item.text);
    } else {
      // Save current chunk and start new one
      if (currentChunk.words.length > 0) {
        currentChunk.text = currentChunk.words.join(' ');
        grouped.push(currentChunk);
      }
      currentChunk = { type: item.type, words: [item.text] };
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.words.length > 0) {
    currentChunk.text = currentChunk.words.join(' ');
    grouped.push(currentChunk);
  }
  
  return grouped;
}
