# Family Memories Media Gallery — Digital Archive

A modern, responsive, and elegant digital heritage archive for organizing family memory categories and accessing corresponding Google Drive folders.

---

## 1. Project Structure

```text
FamilyMemories/
│
├── index.html              # Main HTML entry point with accessible markup & layout
├── css/
│   └── style.css           # Luxury design system, glassmorphism, responsive grid & themes
├── js/
│   ├── parser.js           # Flexible text parser for memories.txt & future metadata
│   └── app.js              # Application state, live search, multi-factor filters & sorting
├── data/
│   ├── memories.txt        # The primary source of truth (your text file)
│   └── defaultData.js      # Bundled fallback dataset (enables instant offline/file:// use)
├── serve.js                # Lightweight local server (port 3000)
└── README.md               # Complete project documentation & guide
```

---

## 2. What Was Implemented

1. **Dynamic Category & Subfolder Rendering**:
   - Zero hardcoded cards in HTML.
   - Every category and subfolder is dynamically extracted from `data/memories.txt`.
   - Categories with multiple folders/videos (such as *HiR Marriege Images* with 5 ceremony folders and *HiR Marriege Videos* with 7 parts) clearly list every item with dedicated direct links.

2. **Clickable Subfolders & Direct Google Drive Access**:
   - Every subfolder is an interactive, clickable card row that directly launches the Google Drive folder or video file.
   - Includes visual media indicators (🖼️ for Photos, 🎥 for Videos, 📁 for Folders).
   - Hover animations, Google Drive branding badge, and direct `target="_blank"` with `rel="noopener noreferrer"`.
   - The redundant category-level Google Drive button at the bottom of cards has been removed, providing a much cleaner, streamlined card layout.

3. **Dynamic Filtering & Intelligent Inferences**:
   - **Event Types**: Automatically adapts based on parsed categories (*Birthday, Wedding, Pre-Wedding, Baby Shower, Traditional Ritual, Jal Ceremony, Val Celebration*).
   - **Family Members**: Detected and filtered dynamically (*Dhruv, HiR, Rinku*).
   - **Media Filter**: Instant toggle for *Photos Only* or *Videos Only*.
   - **Favorites**: Filter for bookmarked collections (*♥ Favorites*).

4. **Instant Dynamic Search**:
   - Real-time search across Category Name, Description, Subfolder Name, Event Type, Person, Year, Date, Location, and Google Drive URLs.
   - Quick clear button `✕` and keyboard `ESC` shortcut.

5. **Sorting Capabilities**:
   - Default Order (matches text file)
   - Category A → Z
   - Category Z → A
   - Most Subfolders / Files First
   - Fewest Subfolders / Files First

6. **View Modes**:
   - **Grid View**: Rich, responsive cards (3–4 columns on desktop, 2 on tablet, 1 on mobile).
   - **List View**: Compact horizontal stream for quick scanning.

7. **Aesthetics & Micro-Animations**:
   - Ambient luxury glow effects and glassmorphism.
   - Curated typography (*Outfit* for headings, *Inter* for body text).
   - Category-specific icons (🎂, 💍, 👶, 💑, 🪔, 🌊, 🎉, 💾, 📸).
   - Smooth hover lifts, card glow borders, and heart animations.

8. **Light / Dark Mode**:
   - Quick toggle (🌙 / ☀️) persisted in browser `localStorage`.

9. **Data Source Manager / In-Browser Updater**:
   - Accessible via the **"📁 Data Source"** button in the top navigation.
   - Displays current text file content.
   - Allows pasting new text or loading any `.txt` file directly from your computer to test instant live updates without manual code editing.

10. **Dual Mode Compatibility (HTTP & file://)**:
    - Automatically fetches `data/memories.txt` when served over HTTP.
    - Seamlessly falls back to `data/defaultData.js` if double-clicked directly from Windows Explorer (`file:///` protocol) where browsers restrict local `fetch()`.

---

## 3. How to Add Future Categories

You **never** need to touch the HTML or JavaScript files to add or edit categories. Simply edit `data/memories.txt`.

### Basic Category Format

```text
------------------------------------------------------
Dhruv Graduation Ceremony
------------------------------------------------------

Description : Graduation day memories and degree convocation
Year : 2027
Date : 15 May 2027
Event Type : Graduation
Person : Dhruv
Location : University Auditorium

Folder Name : Stage Photos
Google Drive URL : https://drive.google.com/drive/folders/YOUR_GRADUATION_PHOTOS_ID?usp=sharing

Folder Name : Convocation Videos
Google Drive URL : https://drive.google.com/drive/folders/YOUR_GRADUATION_VIDEOS_ID?usp=sharing
```

### Supported Parameters (All Optional & Dynamic)

| Parameter | Example | Notes |
| :--- | :--- | :--- |
| **Category Name** | `Dhruv Graduation` | Placed inside `---` dividers or as `Category : Name` |
| **Folder Name** | `Stage Photos` | Subfolder name. Can be repeated multiple times per category |
| **Google Drive URL** | `https://drive.google.com/...` | Drive folder or file link |
| **Description** | `Graduation day photos...` | Summary displayed on the card |
| **Year** | `2027` | Filterable and sortable year |
| **Date** | `15 May 2027` | Formatted date string |
| **Event Type** | `Graduation`, `Wedding`, `Birthday` | Creates dynamic filter pills automatically |
| **Person** | `Dhruv`, `HiR`, `Rinku` | Creates family member filter pills |
| **Location** | `Ahmedabad` | Displays location badge |
| **Any Custom Key** | `Photographer : Studio XYZ` | Automatically rendered in the card metadata grid |

---

## 4. How the System Works

```text
       ┌───────────────────────────────┐
       │      data/memories.txt        │
       │   (Your raw text file source) │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │         js/parser.js          │
       │ (Parses blocks, items, fields,│
       │  infers icons & event types)  │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │       JavaScript State        │
       │ (Array of structured objects) │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │           js/app.js           │
       │ (Search, multi-filter, sort,  │
       │  favorites & theme state)     │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │     Dynamic Modern UI         │
       │  (Interactive luxury cards &  │
       │   direct Google Drive links)  │
       └───────────────────────────────┘
```

---

## 5. How to Run Locally

### Option A: Local Dev Server (Recommended)
1. Open PowerShell in this folder:
   ```powershell
   node serve.js
   ```
2. Open your browser at:
   ```text
   http://localhost:3000/
   ```

### Option B: Direct Double-Click
You can also directly double-click `index.html` to open it in your browser. The embedded fallback system ensures everything loads and functions smoothly offline!
