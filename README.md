# Re-Source - A Wikipedia Change Detector

A browser extension that detects edits, removals, and potential censorship on Wikipedia pages by comparing the live page to archived versions from the Wayback Machine.

---

## Authors

Re-Source Project Team  
Sarah Fadenrecht  
Jason Carey  
Caden Lofgren  

CS 4930 – Privacy and Censorship  
Instructor: Dr. Serena Sullivan  
Fall 2025


---

## Overview:
Re-Source is a lightweight browser extension that analyzes any Wikipedia page and checks for changes by comparing the current live HTML and one or more archived snapshots pulled from the Wayback Machine.

It highlights the differences, calculates a similarity percentage, and displays what content may have been modified, removed, or censored. The goal is to improve transparency and help users detect potential censorship or quiet edits on publicly accessible pages.

---

## Features

- One-click page comparison through the browser extension popup  
- Retrieves archived versions of the current Wikipedia page  
- Strips styling to compare raw HTML accurately  
- Highlights detected changes  
- Displays the percentage of similarity or change  
- Allows switching between multiple archived dates  
- Processes data entirely on the client side to preserve user privacy

---

## Installation and Usage

### 1. Download the Project
Clone or download the repository:

```bash
git clone https://github.com/sarahfad/cs4930
```

### 2. Open the Chrome Extensions Page
Navigate to:
chrome://extensions


### 3. Enable Developer Mode
- Toggle the "Developer mode" switch in the top-right corner.
  
### 4. Load the Unpacked Extension
- Click "Load unpacked"
- Select the project folder
- The extension will load into Chrome

### 5. Using the Extension
- Visit any Wikipedia page
- Click the extension icon
- Select "Analyze Page" in the popup
- The popup will display differences and a comparison summary

---

## How It Works

1. The extension captures the live HTML content of the current Wikipedia page.
2. It requests the closest archived snapshot using the Wayback Machine API.
3. Both versions undergo cleaning to remove styling, scripts, and non-content markup.
4. A comparison script analyzes text differences and structural changes.
5. The popup displays:
   - Percentage similarity
   - Highlighted text differences
   - Options to switch between archived dates


---

## Limitations

- Currently supports only Wikipedia pages
- Does not detect network-level censorship
- Comparison results depend on the availability of archived snapshots

---

## References

- Duncan, S. P., & Chen, H. (2023). *Detecting network-based internet censorship via latent feature representation learning.* arXiv:2209.05152. https://arxiv.org/abs/2209.05152  

- Elmas, T., Overdorf, R., & Aberer, K. (2021). *A dataset of state-censored tweets.* arXiv. https://doi.org/10.48550/arXiv.2101.05919  

- Liu, J., & Zhao, J. (2021). *More than plain text: Censorship deletion in the Chinese social media.* Journal of the Association for Information Science and Technology, 72(1), 18–31. https://doi.org/10.1002/asi.24390  

- Roberts, S. T. (2018). *Digital subterfuge: The evolution of censorship in the information age.* Journal of Communication Inquiry, 42(3), 239–256. https://doi.org/10.1177/0196859918774601  

- Tang, J., Alvarez, L., Brar, A., Hoang, N. P., & Christin, N. (2024). *Automatic generation of web censorship probe lists.* arXiv:2407.08185. https://doi.org/10.48550/arXiv.2407.08185  

- Tsai, E., Sundara, R., Raman, A., Prakash, A., & Ensafi, R. (2024). *Modeling and detecting internet censorship events.* NDSS Symposium 2024. https://www.ndss-symposium.org/wp-content/uploads/2024-409-paper.pdf  

- Tufekci, Z. (2021). *The precarity of free expression in algorithmic spaces.* Social Media + Society, 7(2), 1–10. https://doi.org/10.1177/20563051211019054  

- Wendzel, S., Volpert, S., Zillien, S., Lenz, J., Rünz, P., & Caviglione, L. (2025). *A survey of internet censorship and its measurement: Methodology, trends, and challenges.* arXiv:2502.14945. https://arxiv.org/abs/2502.14945  

- Zhou, Y., Wang, C., & Liu, H. (2023). *Information manipulation and the hidden web: Measuring online censorship effects.* Computers & Security, 127, 103173. https://doi.org/10.1016/j.cose.2023.103173  

