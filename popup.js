import { compareSnapshots } from "./compareSnapshots.js";

let availableSnapshots = [];
let currentUrl = null;

// Load available dates when popup opens
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && tab.url.includes("wikipedia.org")) {
      currentUrl = tab.url;
      await loadAvailableDates(tab.url);
    }
  } catch (error) {
    console.error("Error loading dates:", error);
  }
})();

async function loadAvailableDates(url) {
  const dateSelector = document.getElementById("date-selector");
  const dateSelect = document.getElementById("date-select");
  const dateInfo = document.getElementById("date-info");
  
  dateSelector.style.display = "block";
  dateSelect.disabled = true;
  dateSelect.innerHTML = '<option value="">Loading available dates...</option>';
  dateInfo.textContent = "Fetching available archive dates...";
  dateInfo.className = "date-info date-loading";
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: "fetch_snapshots",
      url: url
    });
    
    if (!response.success) {
      throw new Error(response.error || "Failed to fetch snapshots");
    }
    
    availableSnapshots = response.snapshots || [];
    
    if (availableSnapshots.length === 0) {
      dateSelect.innerHTML = '<option value="">No archives available</option>';
      dateInfo.textContent = "No archived versions found for this page.";
      dateInfo.className = "date-info";
      return;
    }
    
    // Populate dropdown with dates
    dateSelect.innerHTML = '<option value="closest">Use closest archive (default)</option>';
    availableSnapshots.forEach((snapshot, index) => {
      const option = document.createElement("option");
      option.value = snapshot.timestamp;
      option.textContent = `${snapshot.dateFormatted} (${snapshot.dateString})`;
      dateSelect.appendChild(option);
    });
    
    dateSelect.disabled = false;
    dateInfo.textContent = `Found ${availableSnapshots.length} available archives. Select one or use closest.`;
    dateInfo.className = "date-info";
    
  } catch (error) {
    console.error("Error loading dates:", error);
    dateSelect.innerHTML = '<option value="closest">Error loading dates - using closest</option>';
    dateInfo.textContent = `Error: ${error.message}. Using closest archive instead.`;
    dateInfo.className = "date-info";
    dateSelect.disabled = false;
  }
}

document.getElementById("analyze").addEventListener("click", async () => {
  const resultBox = document.getElementById("result");
  const diffView = document.getElementById("diff-view");
  const analyzeButton = document.getElementById("analyze");
  
  resultBox.innerText = "Analyzing...";
  resultBox.style.color = "blue";
  diffView.style.display = "none";
  diffView.innerHTML = "";
  analyzeButton.disabled = true;

  try {
    // Step 1: Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("wikipedia.org")) {
      resultBox.innerText = "⚠️ Please visit a Wikipedia page first.";
      resultBox.style.color = "orange";
      analyzeButton.disabled = false;
      document.getElementById("date-selector").style.display = "none";
      return;
    }
    
    // Update available dates if URL changed
    if (currentUrl !== tab.url) {
      currentUrl = tab.url;
      await loadAvailableDates(tab.url);
    }

    console.log("Analyzing tab:", tab.url);

    // Step 2: Get current page HTML from content script
    const current = await chrome.tabs.sendMessage(tab.id, { action: "get_page_html" });
    console.log("Current page HTML length:", current.html?.length || 0);

    // Step 3: Get selected date or use closest
    const dateSelect = document.getElementById("date-select");
    let selectedTimestamp = dateSelect ? dateSelect.value : null;
    
    // If dates are still loading, default to closest
    if (!selectedTimestamp || selectedTimestamp === "") {
      selectedTimestamp = "closest";
    }
    
    let archivedHtml = null;
    let archiveDate = null;
    let archiveUrl = null;

    if (selectedTimestamp && selectedTimestamp !== "closest") {
      // Fetch specific date
      console.log("Fetching archive for date:", selectedTimestamp);
      const archivedData = await chrome.runtime.sendMessage({
        action: "fetch_archived_by_date",
        url: current.url,
        timestamp: selectedTimestamp
      });

      if (!archivedData.success) {
        throw new Error("Failed to fetch archived HTML: " + archivedData.error);
      }

      archivedHtml = archivedData.html;
      archiveUrl = archivedData.url;
      archiveDate = availableSnapshots.find(s => s.timestamp === selectedTimestamp);
      console.log("Archived HTML length:", archivedHtml.length);
    } else {
      // Use closest archive (default behavior)
      const archiveInfo = await chrome.runtime.sendMessage({
        action: "fetch_wayback",
        url: current.url
      });

      if (!archiveInfo.success) {
        throw new Error("Failed to fetch Wayback data: " + archiveInfo.error);
      }

      console.log("Wayback API response:", archiveInfo.data);
      archiveUrl = archiveInfo.data?.archived_snapshots?.closest?.url;

      if (archiveUrl) {
        console.log("Archived snapshot found:", archiveUrl);
        
        // Step 4: Fetch archived HTML via background script (to avoid CORS)
        const archivedData = await chrome.runtime.sendMessage({
          action: "fetch_archived_html",
          url: archiveUrl
        });

        if (!archivedData.success) {
          throw new Error("Failed to fetch archived HTML: " + archivedData.error);
        }

        archivedHtml = archivedData.html;
        
        // Try to extract date from URL
        const urlMatch = archiveUrl.match(/web\/(\d{14})/);
        if (urlMatch) {
          const timestamp = urlMatch[1];
          const year = timestamp.substring(0, 4);
          const month = timestamp.substring(4, 6);
          const day = timestamp.substring(6, 8);
          const hour = timestamp.substring(8, 10);
          const minute = timestamp.substring(10, 12);
          archiveDate = {
            dateFormatted: new Date(year, month - 1, day, hour, minute).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          };
        }
        
        console.log("Archived HTML length:", archivedHtml.length);
      } else {
        console.warn("⚠️ No archived snapshot found for this page.");
        resultBox.innerText = "No archived version found in Wayback Machine.";
        resultBox.style.color = "orange";
        analyzeButton.disabled = false;
        return;
      }
    }

    if (!archivedHtml) {
      throw new Error("Failed to fetch archived HTML");
    }

    // Step 5: Compare snapshots
    const result = compareSnapshots(current.html, archivedHtml);

    // Step 6: Display result summary
    const archiveDateText = archiveDate ? `Archive date: ${archiveDate.dateFormatted}` : "Archive date: unknown";
    
    if (result.changed) {
      resultBox.innerHTML = `
        <strong style="color: red;">⚠️ Changes Detected</strong><br>
        ${result.reason}<br>
        <small>Similarity: ${result.similarity} | Character difference: ${result.diffCount || 'multiple'}<br>
        ${archiveDateText}</small>
      `;
    } else {
      resultBox.innerHTML = `
        <strong style="color: green;">✓ No Significant Changes</strong><br>
        <small>${result.reason}<br>
        ${archiveDateText}</small>
      `;
    }

    // Step 7: Display detailed diff visualization if changes detected
    if (result.changed && result.wordDiff) {
      renderDiffView(result, diffView, archiveDate);
    }
  } catch (error) {
    console.error("Error in analysis:", error);
    resultBox.innerText = `❌ Error: ${error.message}`;
    resultBox.style.color = "red";
  } finally {
    analyzeButton.disabled = false;
  }
});

function renderDiffView(result, diffView, archiveDate) {
  const chunks = result.wordDiff || [];
  
  if (!chunks || chunks.length === 0) {
    diffView.innerHTML = '<div class="diff-content" style="padding: 10px; color: #666;">No detailed diff available.</div>';
    diffView.style.display = "block";
    return;
  }
  
  // Calculate statistics
  const addedCount = chunks.filter(c => c.type === 'added').length;
  const removedCount = chunks.filter(c => c.type === 'removed').length;
  const unchangedCount = chunks.filter(c => c.type === 'unchanged').length;
  
  // Group chunks into change blocks for better readability
  const groupedBlocks = groupChunksIntoBlocks(chunks);
  
  // Count blocks with changes for display
  const changedBlocksCount = groupedBlocks.filter(b => b.hasChanges).length;
  
  // Build HTML
  const archiveDateText = archiveDate ? ` (${archiveDate.dateFormatted})` : "";
  let diffHTML = `
    <div class="diff-header">
      <span>Detailed Changes${archiveDateText}</span>
      <span style="font-size: 11px; font-weight: normal;">
        <span style="color: #721c24;">−${removedCount}</span> | 
        <span style="color: #155724;">+${addedCount}</span> | 
        <span style="color: #666;">~${unchangedCount}</span>
      </span>
    </div>
    <div class="diff-controls">
      <label>
        <input type="checkbox" id="hide-unchanged" checked>
        Hide unchanged text
      </label>
      <span style="color: #666; font-size: 10px;">${changedBlocksCount} change region${changedBlocksCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="diff-content">
  `;
  
  // Render organized diff blocks
  groupedBlocks.forEach((block, blockIndex) => {
    const blockClass = block.hasChanges ? 'diff-block-changed' : 'diff-block-unchanged';
    const blockAdditions = block.chunks.filter(c => c.type === 'added').length;
    const blockRemovals = block.chunks.filter(c => c.type === 'removed').length;
    
    diffHTML += `<div class="diff-block ${blockClass}">`;
    
    // Add change indicator for changed blocks
    if (block.hasChanges && (blockAdditions > 0 || blockRemovals > 0)) {
      diffHTML += `<div class="diff-block-indicator">`;
      if (blockRemovals > 0) {
        diffHTML += `<span class="diff-indicator-removed">−${blockRemovals}</span>`;
      }
      if (blockAdditions > 0) {
        if (blockRemovals > 0) diffHTML += ' ';
        diffHTML += `<span class="diff-indicator-added">+${blockAdditions}</span>`;
      }
      diffHTML += `</div>`;
    }
    
    diffHTML += `<div class="diff-block-content">`;
    
    block.chunks.forEach((chunk, chunkIndex) => {
      const className = `diff-chunk diff-${chunk.type}${chunk.type === 'unchanged' ? ' unchanged-text' : ''}`;
      
      if (chunk.type === 'unchanged') {
        // For unchanged text in change blocks, show context but truncate long sections
        if (chunk.text.length > 150 && block.hasChanges) {
          // Show ellipsis for very long unchanged sections within change blocks
          const truncated = '[...] ' + chunk.text.substring(Math.max(0, chunk.text.length - 60));
          diffHTML += `<span class="${className}" title="${escapeHtml(chunk.text)}">${escapeHtml(truncated)}</span>`;
        } else {
          diffHTML += `<span class="${className}">${escapeHtml(chunk.text)}</span>`;
        }
      } else {
        // Show full changed text (added or removed) - these are important
        diffHTML += `<span class="${className}">${escapeHtml(chunk.text)}</span>`;
      }
      
      // Add space between chunks
      if (chunkIndex < block.chunks.length - 1) {
        diffHTML += ' ';
      }
    });
    
    diffHTML += `</div></div>`;
    
    // Add separator between change blocks
    if (blockIndex < groupedBlocks.length - 1 && block.hasChanges) {
      diffHTML += `<div class="diff-separator"></div>`;
    }
  });
  
  diffHTML += `</div>`;
  
  // Add statistics footer
  diffHTML += `
    <div class="diff-stats">
      <strong>Statistics:</strong><br>
      • Similarity: ${result.similarity}<br>
      • Removed sections: ${removedCount}<br>
      • Added sections: ${addedCount}<br>
      • Character difference: ${result.diffCount} characters
    </div>
  `;
  
  diffView.innerHTML = diffHTML;
  diffView.style.display = "block";
  
    // Add toggle functionality for hiding unchanged text
    const hideCheckbox = diffView.querySelector('#hide-unchanged');
    if (hideCheckbox) {
      hideCheckbox.addEventListener('change', (e) => {
        const unchangedChunks = diffView.querySelectorAll('.unchanged-text');
        const unchangedBlocks = diffView.querySelectorAll('.diff-block-unchanged');
        
        unchangedChunks.forEach(chunk => {
          if (e.target.checked) {
            chunk.style.display = 'none';
          } else {
            chunk.style.display = 'inline';
          }
        });
        
        // Also hide/show unchanged blocks
        unchangedBlocks.forEach(block => {
          if (e.target.checked) {
            block.style.display = 'none';
          } else {
            block.style.display = 'block';
          }
        });
      });
      
      // Initially hide unchanged text if checked
      if (hideCheckbox.checked) {
        const unchangedChunks = diffView.querySelectorAll('.unchanged-text');
        const unchangedBlocks = diffView.querySelectorAll('.diff-block-unchanged');
        
        unchangedChunks.forEach(chunk => {
          chunk.style.display = 'none';
        });
        
        unchangedBlocks.forEach(block => {
          block.style.display = 'none';
        });
      }
    }
  
  // Scroll to diff view
  diffView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Group chunks into readable blocks (change regions vs unchanged regions)
function groupChunksIntoBlocks(chunks) {
  const blocks = [];
  let currentBlock = { chunks: [], hasChanges: false };
  
  const MIN_CHUNKS_FOR_SEPARATE_BLOCK = 3; // Min chunks to form separate unchanged block
  const MAX_UNCHANGED_CONTEXT = 5; // Max unchanged chunks to keep with changes
  
  chunks.forEach((chunk, index) => {
    if (chunk.type === 'unchanged') {
      currentBlock.chunks.push(chunk);
      
      // If we're in a change block and hit too many unchanged chunks, start new block
      if (currentBlock.hasChanges) {
        const unchangedCount = currentBlock.chunks.filter(c => c.type === 'unchanged').length;
        if (unchangedCount > MAX_UNCHANGED_CONTEXT) {
          // Move last few unchanged chunks to new block
          const unchangedChunks = currentBlock.chunks.slice(-unchangedCount);
          const changedChunks = currentBlock.chunks.slice(0, -unchangedCount);
          
          if (changedChunks.length > 0) {
            blocks.push({ chunks: changedChunks, hasChanges: true });
          }
          
          currentBlock = { chunks: unchangedChunks, hasChanges: false };
        }
      }
    } else {
      // We have changes (added or removed)
      if (!currentBlock.hasChanges && currentBlock.chunks.length > 0) {
        // If current block has many unchanged chunks, split it
        if (currentBlock.chunks.length > MIN_CHUNKS_FOR_SEPARATE_BLOCK) {
          blocks.push(currentBlock);
          currentBlock = { chunks: [chunk], hasChanges: true };
        } else {
          // Keep short unchanged context with changes
          currentBlock.hasChanges = true;
          currentBlock.chunks.push(chunk);
        }
      } else {
        currentBlock.hasChanges = true;
        currentBlock.chunks.push(chunk);
      }
    }
  });
  
  // Don't forget the last block
  if (currentBlock.chunks.length > 0) {
    blocks.push(currentBlock);
  }
  
  // Merge small unchanged blocks between change blocks
  const mergedBlocks = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    if (!block.hasChanges && block.chunks.length < MIN_CHUNKS_FOR_SEPARATE_BLOCK) {
      // Merge small unchanged block with adjacent change blocks
      if (mergedBlocks.length > 0 && mergedBlocks[mergedBlocks.length - 1].hasChanges) {
        // Add to previous change block
        mergedBlocks[mergedBlocks.length - 1].chunks.push(...block.chunks);
      } else if (i + 1 < blocks.length && blocks[i + 1].hasChanges) {
        // Add to next change block
        blocks[i + 1].chunks.unshift(...block.chunks);
      } else {
        mergedBlocks.push(block);
      }
    } else {
      mergedBlocks.push(block);
    }
  }
  
  return mergedBlocks;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
