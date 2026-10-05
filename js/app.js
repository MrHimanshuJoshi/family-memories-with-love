/**
 * Family Memories Media Gallery — Application Logic
 * Handles dynamic UI rendering, reactive search, multi-factor filtering,
 * sorting, favorites persistence, dark/light theme, and live data reloading.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    allMemories: [],
    rawText: '',
    searchQuery: '',
    activeFilterType: 'all',
    activeFilterPerson: 'all',
    activeFilterMedia: 'all',
    activeFilterYear: 'all',
    showFavoritesOnly: false,
    currentSort: 'default',
    currentView: 'grid',
    favorites: new Set(),
    dataSource: 'loading' // 'external', 'embedded', or 'user-uploaded'
  };

  // DOM Elements Cache
  const DOM = {
    // Search & Sort Controls
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    sortSelect: document.getElementById('sort-select'),
    filterTypesContainer: document.getElementById('filter-types-container'),
    filterPersonsContainer: document.getElementById('filter-persons-container'),
    filterMediaContainer: document.getElementById('filter-media-container'),
    favoritePill: document.getElementById('favorite-filter-pill'),
    favoriteCountBadge: document.getElementById('favorite-count-badge'),
    // Results & Grid
    resultsCount: document.getElementById('results-count'),
    activeFiltersSummary: document.getElementById('active-filters-summary'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    memoriesGrid: document.getElementById('memories-grid'),
    emptyState: document.getElementById('empty-state'),
    resetEmptyBtn: document.getElementById('reset-empty-btn'),
    // Modal & Data
    openDataModalBtn: document.getElementById('open-data-modal-btn'),
    dataModal: document.getElementById('data-modal'),
    closeDataModalBtn: document.getElementById('close-data-modal-btn'),
    dataTextarea: document.getElementById('data-textarea'),
    applyDataBtn: document.getElementById('apply-data-btn'),
    copyDataBtn: document.getElementById('copy-data-btn'),
    fileInput: document.getElementById('file-input'),
    reloadDefaultBtn: document.getElementById('reload-default-btn'),
    dataSourceBadge: document.getElementById('data-source-badge')
  };

  /**
   * Initialize Application
   */
  async function init() {
    initTheme();
    initFavorites();
    initEventListeners();
    await loadInitialData();
  }

  /**
   * Theme Management (Light Theme Default)
   */
  function initTheme() {
    setTheme('light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('family_memories_theme', 'light');
  }

  /**
   * Favorites Management (localStorage)
   */
  function initFavorites() {
    try {
      const saved = localStorage.getItem('family_memories_favorites');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          state.favorites = new Set(arr);
        }
      }
    } catch (e) {
      console.error('Error loading favorites from localStorage', e);
      state.favorites = new Set();
    }
    updateFavoriteCountBadge();
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }
    try {
      localStorage.setItem('family_memories_favorites', JSON.stringify(Array.from(state.favorites)));
    } catch (e) {
      console.error('Error saving favorites to localStorage', e);
    }
    updateFavoriteCountBadge();
    renderCards();
  }

  function updateFavoriteCountBadge() {
    if (DOM.favoriteCountBadge) {
      DOM.favoriteCountBadge.textContent = state.favorites.size;
    }
  }

  /**
   * Data Loading with Fallback & CORS handling
   */
  async function loadInitialData() {
    try {
      // 1. Try to fetch external data/memories.txt
      const response = await fetch('data/memories.txt?t=' + Date.now());
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const text = await response.text();
      state.rawText = text;
      state.dataSource = 'external (data/memories.txt)';
      parseAndRenderData(text);
    } catch (err) {
      console.warn('Notice: Could not load data/memories.txt directly via HTTP fetch (normal when opened directly via file:// protocol). Falling back to embedded dataset.', err);
      // 2. Fallback to embedded default data
      if (window.DEFAULT_MEMORIES_RAW) {
        state.rawText = window.DEFAULT_MEMORIES_RAW;
        state.dataSource = 'embedded (offline/file://)';
        parseAndRenderData(window.DEFAULT_MEMORIES_RAW);
      } else {
        showError('Unable to load memory data. Please open data settings to provide text.');
      }
    }
  }

  /**
   * Parse Raw Text and Populate UI
   */
  function parseAndRenderData(rawText) {
    state.rawText = rawText;
    const categories = MemoriesParser.parse(rawText);
    state.allMemories = categories;

    if (DOM.dataTextarea) {
      DOM.dataTextarea.value = rawText;
    }

    if (DOM.dataSourceBadge) {
      DOM.dataSourceBadge.textContent = state.dataSource;
    }

    updateHeaderStats();
    buildFilterPills();
    applyFilterAndSort();
  }

  /**
   * Header Statistics
   */
  function updateHeaderStats() {
    const totalCategories = state.allMemories.length;
    let totalFolders = 0;
    const eventTypes = new Set();
    const people = new Set();

    state.allMemories.forEach(cat => {
      totalFolders += (cat.items && cat.items.length) || 1;
      if (cat.eventType) eventTypes.add(cat.eventType);
      if (cat.person) people.add(cat.person);
    });

    if (DOM.statCategories) DOM.statCategories.textContent = totalCategories;
    if (DOM.statFolders) DOM.statFolders.textContent = totalFolders;
    if (DOM.statEvents) DOM.statEvents.textContent = eventTypes.size || 1;
    if (DOM.statPeople) DOM.statPeople.textContent = people.size || 1;
  }

  /**
   * Build Filter Pills Dynamically based on available data
   */
  function buildFilterPills() {
    // 1. Event Types
    const typeCounts = {};
    state.allMemories.forEach(cat => {
      const type = cat.eventType || 'Family Event';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    if (DOM.filterTypesContainer) {
      let typesHtml = `
        <button class="filter-pill ${state.activeFilterType === 'all' ? 'active' : ''}" data-type="all">
          All Events <span class="pill-count">${state.allMemories.length}</span>
        </button>
      `;

      Object.entries(typeCounts).forEach(([type, count]) => {
        const isActive = state.activeFilterType === type ? 'active' : '';
        typesHtml += `
          <button class="filter-pill ${isActive}" data-type="${escapeHtml(type)}">
            ${escapeHtml(type)} <span class="pill-count">${count}</span>
          </button>
        `;
      });
      DOM.filterTypesContainer.innerHTML = typesHtml;

      // Event listener for type pills
      DOM.filterTypesContainer.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          DOM.filterTypesContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.activeFilterType = btn.getAttribute('data-type');
          applyFilterAndSort();
        });
      });
    }

    // 2. People / Family Members
    const personCounts = {};
    state.allMemories.forEach(cat => {
      if (cat.person) {
        personCounts[cat.person] = (personCounts[cat.person] || 0) + 1;
      }
    });

    if (DOM.filterPersonsContainer) {
      const hasPeople = Object.keys(personCounts).length > 0;
      const personGroup = DOM.filterPersonsContainer.closest('.filter-group');
      if (personGroup) {
        personGroup.style.display = hasPeople ? 'flex' : 'none';
      }

      if (hasPeople) {
        let personsHtml = `
          <button class="filter-pill ${state.activeFilterPerson === 'all' ? 'active' : ''}" data-person="all">
            All Members
          </button>
        `;

        Object.entries(personCounts).forEach(([person, count]) => {
          const isActive = state.activeFilterPerson === person ? 'active' : '';
          personsHtml += `
            <button class="filter-pill ${isActive}" data-person="${escapeHtml(person)}">
              👤 ${escapeHtml(person)} <span class="pill-count">${count}</span>
            </button>
          `;
        });
        DOM.filterPersonsContainer.innerHTML = personsHtml;

        DOM.filterPersonsContainer.querySelectorAll('.filter-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            DOM.filterPersonsContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilterPerson = btn.getAttribute('data-person');
            applyFilterAndSort();
          });
        });
      }
    }
  }

  /**
   * Filter and Sort Logic
   */
  function applyFilterAndSort() {
    let filtered = [...state.allMemories];

    // Search Query (Category Name, Description, Subfolder Name, Person, Event, Drive URL, Custom Props)
    if (state.searchQuery) {
      const terms = state.searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      filtered = filtered.filter(cat => {
        const subfolderNames = (cat.items || []).map(i => `${i.name || ''} ${i.driveUrl || ''}`).join(' ');
        const customPropsStr = cat.customProps ? Object.entries(cat.customProps).map(([k, v]) => `${k} ${v}`).join(' ') : '';
        const combined = `
          ${cat.categoryName || ''} 
          ${cat.description || ''} 
          ${cat.eventType || ''} 
          ${cat.person || ''} 
          ${cat.year || ''} 
          ${cat.date || ''} 
          ${cat.location || ''} 
          ${cat.primaryDriveUrl || ''} 
          ${subfolderNames} 
          ${customPropsStr}
        `.toLowerCase();

        return terms.every(term => combined.includes(term));
      });
    }

    // Event Type Filter
    if (state.activeFilterType !== 'all') {
      filtered = filtered.filter(cat => cat.eventType === state.activeFilterType);
    }

    // Person Filter
    if (state.activeFilterPerson !== 'all') {
      filtered = filtered.filter(cat => cat.person === state.activeFilterPerson);
    }

    // Media Filter (Photos / Videos)
    if (state.activeFilterMedia === 'photos') {
      filtered = filtered.filter(cat => cat.hasImages);
    } else if (state.activeFilterMedia === 'videos') {
      filtered = filtered.filter(cat => cat.hasVideos);
    }

    // Favorites Filter
    if (state.showFavoritesOnly) {
      filtered = filtered.filter(cat => state.favorites.has(cat.id));
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (state.currentSort) {
        case 'name-asc':
          return a.categoryName.localeCompare(b.categoryName);
        case 'name-desc':
          return b.categoryName.localeCompare(a.categoryName);
        case 'items-desc':
          return (b.items.length || 0) - (a.items.length || 0);
        case 'items-asc':
          return (a.items.length || 0) - (b.items.length || 0);
        case 'year-desc':
          return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
        case 'year-asc':
          return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
        default:
          return 0; // Original text file order
      }
    });

    state.filteredMemories = filtered;
    renderCards();
    updateResultsSummary();
  }

  /**
   * Helper to group consecutive Part items (e.g. Part 1 - Part 5) into a compact group
   */
  function groupPartItems(items) {
    const result = [];
    let partsGroup = null;

    items.forEach(item => {
      const isPart = /^part\s*\d+/i.test(item.name.trim());
      if (isPart) {
        if (!partsGroup) {
          partsGroup = {
            isGroup: true,
            title: 'Video Parts',
            parts: []
          };
          result.push(partsGroup);
        }
        partsGroup.parts.push(item);
      } else {
        partsGroup = null;
        result.push(item);
      }
    });

    return result;
  }

  /**
   * Render Memory Cards
   */
  function renderCards() {
    const list = state.filteredMemories || [];

    if (list.length === 0) {
      DOM.memoriesGrid.innerHTML = '';
      DOM.emptyState.classList.add('visible');
      return;
    }

    DOM.emptyState.classList.remove('visible');

    let html = '';
    list.forEach(cat => {
      const isFav = state.favorites.has(cat.id);
      const favClass = isFav ? 'favorited' : '';
      const favIcon = isFav ? '♥' : '♡';

      // Build Sub-Folders List (Clickable items opening Google Drive)
      let subfoldersHtml = '';
      const itemsList = (cat.items && cat.items.length > 0) 
        ? cat.items 
        : (cat.primaryDriveUrl ? [{ name: 'View Collection in Google Drive', driveUrl: cat.primaryDriveUrl, type: 'folder' }] : []);

      if (itemsList.length > 0) {
        const processedItems = groupPartItems(itemsList);
        subfoldersHtml = `
          <div class="subfolders-wrapper">
            <div class="subfolders-list">
        `;

        processedItems.forEach(entry => {
          if (entry.isGroup) {
            subfoldersHtml += `
              <div class="subfolder-group-item">
                <div class="subfolder-group-header">
                  <div class="subfolder-info">
                    <span class="subfolder-icon">🎥</span>
                    <span class="subfolder-name">Video Parts (${entry.parts.length})</span>
                  </div>
                  <span class="subfolders-hint">Tap ▶ to Play • Tap 📋 to Copy</span>
                </div>
                <div class="parts-pills-container">
            `;

            entry.parts.forEach(p => {
              const driveUrl = p.driveUrl || cat.primaryDriveUrl;
              subfoldersHtml += `
                <div class="part-pill-split">
                  <a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer" class="part-split-play" title="Play ${escapeHtml(p.name)} in Google Drive">
                    <span class="play-icon-tiny">▶</span>
                    <span>${escapeHtml(p.name)}</span>
                  </a>
                  <button type="button" class="part-split-copy copy-btn" data-url="${escapeHtml(driveUrl)}" data-name="${escapeHtml(p.name)}" title="Copy ${escapeHtml(p.name)} link to share">
                    <svg class="subfolder-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              `;
            });

            subfoldersHtml += `
                </div>
              </div>
            `;
          } else {
            const item = entry;
            let itemIcon = '📁';
            if (item.type === 'image') itemIcon = '🖼️';
            if (item.type === 'video') itemIcon = '🎥';

            const driveUrl = item.driveUrl || cat.primaryDriveUrl;

            if (driveUrl && driveUrl.startsWith('http')) {
              const isVideo = item.type === 'video' || /video|film|movie|part|highlight|title|fuleku|dandiya/i.test(item.name);
              const actionLabel = isVideo ? 'Play' : 'Open';
              const actionIcon = isVideo ? '▶' : '📂';

              subfoldersHtml += `
                <div class="subfolder-item">
                  <a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer" class="subfolder-info-link" title="${actionLabel} ${escapeHtml(item.name)} in Google Drive">
                    <span class="subfolder-icon">${itemIcon}</span>
                    <span class="subfolder-name">${escapeHtml(item.name)}</span>
                  </a>
                  <div class="subfolder-actions">
                    <a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer" class="action-btn-play" title="${actionLabel} ${escapeHtml(item.name)} in Google Drive">
                      <span class="action-btn-icon">${actionIcon}</span>
                      <span>${actionLabel}</span>
                    </a>
                    <button type="button" class="action-btn-copy copy-btn" data-url="${escapeHtml(driveUrl)}" data-name="${escapeHtml(item.name)}" title="Copy ${escapeHtml(item.name)} link to share">
                      <svg class="subfolder-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              `;
            } else {
              subfoldersHtml += `
                <div class="subfolder-item disabled" title="Link not available">
                  <div class="subfolder-info">
                    <span class="subfolder-icon">${itemIcon}</span>
                    <span class="subfolder-name">${escapeHtml(item.name)}</span>
                  </div>
                  <span class="action-btn-disabled">No Link</span>
                </div>
              `;
            }
          }
        });

        subfoldersHtml += `
            </div>
          </div>
        `;
      }

      html += `
        <article class="memory-card" id="${cat.id}">
          <div class="card-header">
            <div class="card-icon-title">
              <div class="card-icon" role="img" aria-label="${escapeHtml(cat.categoryName)} icon">${cat.icon}</div>
              <div class="card-title-group">
                <h2 class="card-title">${escapeHtml(cat.categoryName)}</h2>
              </div>
            </div>
            <button class="favorite-btn ${favClass}" data-id="${cat.id}" aria-label="Toggle favorite for ${escapeHtml(cat.categoryName)}" title="Save as Favorite">
              ${favIcon}
            </button>
          </div>

          <div class="card-body">
            ${cat.description ? `<p class="card-description">${escapeHtml(cat.description)}</p>` : ''}
            ${subfoldersHtml}
          </div>
        </article>
      `;
    });

    DOM.memoriesGrid.innerHTML = html;

    // Attach Favorite Event Listeners
    DOM.memoriesGrid.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        toggleFavorite(id);
      });
    });

    // Attach Copy URL Event Listeners
    DOM.memoriesGrid.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        copyTextToClipboard(url, btn);
      });
    });
  }

  /**
   * Clipboard Helper with fallback
   */
  function copyTextToClipboard(text, targetBtn) {
    if (!text) return;

    const itemName = targetBtn.getAttribute('data-name') || '';
    const onSuccess = () => {
      const originalHtml = targetBtn.innerHTML;
      targetBtn.classList.add('copied');

      if (targetBtn.classList.contains('part-split-copy')) {
        targetBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;stroke:#16a34a;display:inline-block;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      } else {
        targetBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;stroke:#16a34a;display:inline-block;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color:#16a34a; font-weight:700;">Copied!</span>
        `;
      }

      showFloatingToast(itemName ? `📋 ${itemName} link copied! Ready to share.` : '📋 Link copied to clipboard! Ready to share.');
      setTimeout(() => {
        targetBtn.classList.remove('copied');
        targetBtn.innerHTML = originalHtml;
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  }

  let toastTimer = null;
  function showFloatingToast(msg) {
    let toast = document.getElementById('app-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-floating-toast';
      toast.className = 'floating-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  }

  function fallbackCopy(text, callback) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      callback();
    } catch (e) {
      console.error('Copy failed', e);
    }
    document.body.removeChild(textarea);
  }

  /**
   * Update Results Summary Text
   */
  function updateResultsSummary() {
    const total = state.allMemories.length;
    const shown = (state.filteredMemories || []).length;
    
    if (DOM.resultsCount) {
      if (total === shown) {
        DOM.resultsCount.innerHTML = `Showing all <strong>${total}</strong> memories`;
      } else {
        DOM.resultsCount.innerHTML = `Showing <strong>${shown}</strong> of <strong>${total}</strong> memories`;
      }
    }

    // Check if any filters are active
    const hasActiveFilters = 
      state.searchQuery || 
      state.activeFilterType !== 'all' || 
      state.activeFilterPerson !== 'all' || 
      state.activeFilterMedia !== 'all' || 
      state.showFavoritesOnly;

    if (DOM.activeFiltersSummary) {
      DOM.activeFiltersSummary.style.display = hasActiveFilters ? 'flex' : 'none';
    }
  }

  /**
   * Reset All Filters to Default
   */
  function resetAllFilters() {
    state.searchQuery = '';
    state.activeFilterType = 'all';
    state.activeFilterPerson = 'all';
    state.activeFilterMedia = 'all';
    state.showFavoritesOnly = false;
    state.currentSort = 'default';

    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.clearSearchBtn) DOM.clearSearchBtn.classList.remove('visible');
    if (DOM.sortSelect) DOM.sortSelect.value = 'default';

    // Reset UI buttons
    document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
    
    if (DOM.filterTypesContainer) {
      const defaultTypePill = DOM.filterTypesContainer.querySelector('[data-type="all"]');
      if (defaultTypePill) defaultTypePill.classList.add('active');
    }

    if (DOM.filterPersonsContainer) {
      const defaultPersonPill = DOM.filterPersonsContainer.querySelector('[data-person="all"]');
      if (defaultPersonPill) defaultPersonPill.classList.add('active');
    }

    if (DOM.filterMediaContainer) {
      const defaultMediaPill = DOM.filterMediaContainer.querySelector('[data-media="all"]');
      if (defaultMediaPill) defaultMediaPill.classList.add('active');
    }

    if (DOM.favoritePill) DOM.favoritePill.classList.remove('active');

    applyFilterAndSort();
  }

  /**
   * Event Listeners Registration
   */
  function initEventListeners() {
    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (DOM.clearSearchBtn) {
        DOM.clearSearchBtn.classList.toggle('visible', state.searchQuery.length > 0);
      }
      applyFilterAndSort();
    });

    // Clear search button
    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.searchQuery = '';
      DOM.clearSearchBtn.classList.remove('visible');
      applyFilterAndSort();
      DOM.searchInput.focus();
    });

    // Keyboard ESC clears search
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (state.searchQuery) {
          DOM.searchInput.value = '';
          state.searchQuery = '';
          DOM.clearSearchBtn.classList.remove('visible');
          applyFilterAndSort();
        }
        if (DOM.dataModal.classList.contains('open')) {
          closeModal();
        }
      }
    });

    // Sort select
    DOM.sortSelect.addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      applyFilterAndSort();
    });

    // Media Filter Pills (All, Photos, Videos)
    if (DOM.filterMediaContainer) {
      DOM.filterMediaContainer.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          DOM.filterMediaContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.activeFilterMedia = btn.getAttribute('data-media');
          applyFilterAndSort();
        });
      });
    }

    // Favorites Pill
    if (DOM.favoritePill) {
      DOM.favoritePill.addEventListener('click', () => {
        state.showFavoritesOnly = !state.showFavoritesOnly;
        DOM.favoritePill.classList.toggle('active', state.showFavoritesOnly);
        applyFilterAndSort();
      });
    }

    // Reset Buttons
    if (DOM.resetFiltersBtn) {
      DOM.resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
    if (DOM.resetEmptyBtn) {
      DOM.resetEmptyBtn.addEventListener('click', resetAllFilters);
    }

    // Modal Dialog Controls
    DOM.openDataModalBtn.addEventListener('click', openModal);
    DOM.closeDataModalBtn.addEventListener('click', closeModal);
    DOM.dataModal.addEventListener('click', (e) => {
      if (e.target === DOM.dataModal) closeModal();
    });

    // Apply edited text in modal
    if (DOM.applyDataBtn) {
      DOM.applyDataBtn.addEventListener('click', () => {
        const newText = DOM.dataTextarea.value;
        if (newText && newText.trim()) {
          state.dataSource = 'user-updated (editor)';
          parseAndRenderData(newText);
          closeModal();
        }
      });
    }

    // Copy Full Data Source Button
    if (DOM.copyDataBtn) {
      DOM.copyDataBtn.addEventListener('click', () => {
        const fullText = (DOM.dataTextarea && DOM.dataTextarea.value) ? DOM.dataTextarea.value : state.rawText;
        if (!fullText) return;

        const originalHtml = DOM.copyDataBtn.innerHTML;
        DOM.copyDataBtn.classList.add('copied');
        DOM.copyDataBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:#16a34a;display:inline-block;vertical-align:middle;margin-right:4px;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color:#16a34a; font-weight:700;">Copied Full Data!</span>
        `;
        showFloatingToast('📋 Full updated data source copied to clipboard!');

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullText).catch(() => {
            fallbackCopy(fullText, () => {});
          });
        } else {
          fallbackCopy(fullText, () => {});
        }

        setTimeout(() => {
          DOM.copyDataBtn.classList.remove('copied');
          DOM.copyDataBtn.innerHTML = originalHtml;
        }, 2200);
      });
    }

    // File Upload Handler
    DOM.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          state.dataSource = `uploaded file (${file.name})`;
          parseAndRenderData(content);
          closeModal();
        };
        reader.readAsText(file);
      }
    });

    // Reload Default Data
    DOM.reloadDefaultBtn.addEventListener('click', () => {
      if (window.DEFAULT_MEMORIES_RAW) {
        state.dataSource = 'embedded default';
        parseAndRenderData(window.DEFAULT_MEMORIES_RAW);
        closeModal();
      }
    });
  }

  function openModal() {
    DOM.dataModal.classList.add('open');
  }

  function closeModal() {
    DOM.dataModal.classList.remove('open');
  }

  /**
   * Helper: Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showError(msg) {
    console.error(msg);
    if (DOM.memoriesGrid) {
      DOM.memoriesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ff758c;">
          <h3>⚠️ Error</h3>
          <p>${escapeHtml(msg)}</p>
        </div>
      `;
    }
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
