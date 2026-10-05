/**
 * Family Memories - Data Parser
 * Robustly parses text files containing category and media drive links.
 * Handles flexible structures, multiple sub-folders per category,
 * custom key-value metadata, and auto-inference for icons, event types, and family members.
 */

class MemoriesParser {
  /**
   * Main parsing function
   * @param {string} rawText - Raw content of the text file
   * @returns {Array} Array of parsed category objects
   */
  static parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return [];
    }

    const lines = rawText.split(/\r?\n/);
    const blocks = [];
    let blockLines = [];

    const isDividerLine = (line) => {
      const trimmed = line.trim();
      return /^[-\=_*~]{3,}$/.test(trimmed);
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (isDividerLine(line)) {
        // Look ahead: is the next line a title and followed by another divider line?
        // e.g.:
        // --------------------
        // Dhruv Birthday
        // --------------------
        if (i + 2 < lines.length && isDividerLine(lines[i + 2]) && lines[i + 1].trim().length > 0) {
          if (blockLines.length > 0) {
            blocks.push(blockLines);
            blockLines = [];
          }
          const title = lines[i + 1].trim();
          blockLines.push(`Category : ${title}`);
          i += 2; // skip title and closing divider
          continue;
        } else {
          // Single divider line separating blocks
          if (blockLines.length > 0) {
            blocks.push(blockLines);
            blockLines = [];
          }
          continue;
        }
      }

      if (trimmed.startsWith('#')) {
        // Markdown style header e.g. # Title or ## Title
        if (blockLines.length > 0) {
          blocks.push(blockLines);
          blockLines = [];
        }
        blockLines.push(`Category : ${trimmed.replace(/^#+\s*/, '')}`);
        continue;
      }

      if (trimmed.length > 0) {
        blockLines.push(line);
      }
    }

    if (blockLines.length > 0) {
      blocks.push(blockLines);
    }

    // Parse each block into a structured category object
    const categories = [];
    blocks.forEach((bLines, index) => {
      const parsedCat = this.parseBlock(bLines, index);
      if (parsedCat && (parsedCat.categoryName || parsedCat.items.length > 0)) {
        categories.push(parsedCat);
      }
    });

    return categories;
  }

  /**
   * Parse a single block of lines into a Category object
   */
  static parseBlock(lines, index) {
    let categoryName = '';
    const items = [];
    const customProps = {};
    let currentItem = null;

    // Track standard properties
    let description = '';
    let year = '';
    let date = '';
    let eventType = '';
    let person = '';
    let driveUrl = '';
    let location = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for key : value format
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).trim().toLowerCase();
        const value = line.substring(colonIdx + 1).trim();

        if (['category', 'category name', 'title', 'name'].includes(key)) {
          categoryName = value;
          continue;
        }

        if (['folder name', 'sub folder', 'sub folder name', 'folder', 'subfolder', 'album'].includes(key)) {
          if (currentItem) {
            items.push(currentItem);
          }
          currentItem = {
            name: value,
            driveUrl: '',
            type: this.detectMediaType(value)
          };
          continue;
        }

        if (['google drive url', 'drive url', 'drive link', 'url', 'link', 'google drive link'].includes(key)) {
          if (currentItem) {
            currentItem.driveUrl = value;
            items.push(currentItem);
            currentItem = null;
          } else {
            driveUrl = value;
          }
          continue;
        }

        if (['description', 'desc', 'details', 'summary'].includes(key)) {
          description = value;
          continue;
        }

        if (key === 'year') {
          year = value;
          continue;
        }

        if (key === 'date') {
          date = value;
          continue;
        }

        if (['event type', 'event', 'type'].includes(key)) {
          eventType = value;
          continue;
        }

        if (['person', 'family member', 'members', 'people', 'celebrant'].includes(key)) {
          person = value;
          continue;
        }

        if (['location', 'place', 'venue', 'city'].includes(key)) {
          location = value;
          continue;
        }

        // Any other dynamic parameter from text file
        const originalKey = line.substring(0, colonIdx).trim();
        customProps[originalKey] = value;
      } else {
        // If line is not a key:value pair
        if (!categoryName && items.length === 0) {
          categoryName = line;
        } else if (currentItem && !currentItem.driveUrl && this.isValidUrl(line)) {
          currentItem.driveUrl = line;
          items.push(currentItem);
          currentItem = null;
        } else if (!driveUrl && this.isValidUrl(line)) {
          driveUrl = line;
        }
      }
    }

    if (currentItem) {
      items.push(currentItem);
    }

    if (!categoryName) {
      categoryName = `Memory Collection #${index + 1}`;
    }

    // Determine primary Drive URL (first item's drive url or category level drive url)
    const primaryDriveUrl = driveUrl || (items.length > 0 && items[0].driveUrl ? items[0].driveUrl : '');

    // Smart inferences
    const inferred = this.inferMetadata(categoryName, items, { year, date, eventType, person, description, location });

    return {
      id: `cat-${index + 1}-${this.slugify(categoryName)}`,
      categoryName,
      description: description || '',
      year: year || inferred.year,
      date: date || inferred.date,
      eventType: eventType || inferred.eventType,
      person: person || inferred.person,
      location: location || inferred.location,
      items,
      primaryDriveUrl,
      icon: inferred.icon,
      isSingleFolder: items.length === 1,
      totalItems: items.length,
      hasImages: items.some(item => item.type === 'image') || /image|photo|pic/i.test(categoryName),
      hasVideos: items.some(item => item.type === 'video') || /video|film|movie/i.test(categoryName),
      customProps
    };
  }

  /**
   * Helper to detect media type from item/folder name
   */
  static detectMediaType(name) {
    const lower = name.toLowerCase();
    if (lower.includes('video') || lower.includes('highlight') || lower.includes('clip') || lower.includes('part ') || lower.includes('movie') || lower.includes('fuleku') || lower.includes('dandiya')) {
      return 'video';
    }
    if (lower.includes('image') || lower.includes('photo') || lower.includes('pic') || lower.includes('edit') || lower.includes('album') || lower.includes('mandvo') || lower.includes('pithi') || lower.includes('fera')) {
      return 'image';
    }
    return 'folder';
  }

  /**
   * Smart inferences based on title and subfolders
   */
  static inferMetadata(title, items, current) {
    const t = title.toLowerCase();
    let icon = '📸';
    let eventType = current.eventType || '';
    let person = current.person || '';
    let year = current.year || '';
    let date = current.date || '';
    let location = current.location || '';
    let description = current.description || '';

    // Infer Event Type & Icon in priority order
    if (t.includes('birthday') || t.includes('bday')) {
      icon = '🎂';
      if (!eventType) eventType = 'Birthday';
    } else if (t.includes('pre wedding') || t.includes('pre-wedding') || t.includes('prewedding')) {
      icon = '💑';
      if (!eventType) eventType = 'Pre-Wedding';
    } else if (t.includes('baby shower') || t.includes('shrimant') || t.includes('godh bharai')) {
      icon = '👶';
      if (!eventType) eventType = 'Baby Shower';
    } else if (t.includes('kankupagla') || t.includes('kanku pagla')) {
      icon = '🪔';
      if (!eventType) eventType = 'Traditional Ritual';
    } else if (t.includes('jal ceremony') || t.includes('jal')) {
      icon = '🌊';
      if (!eventType) eventType = 'Jal Ceremony';
      if (!location && items.some(i => i.name.toLowerCase().includes('river front'))) {
        location = 'Home & River Front';
      }
    } else if (t.includes('ni val') || t.includes('val')) {
      icon = '🎉';
      if (!eventType) eventType = 'Val Celebration';
    } else if (t.includes('marriege') || t.includes('marriage') || t.includes('wedding')) {
      icon = '💍';
      if (!eventType) eventType = 'Wedding';
    } else if (t.includes('travel') || t.includes('trip') || t.includes('tour') || t.includes('vacation')) {
      icon = '✈️';
      if (!eventType) eventType = 'Travel';
    } else if (t.includes('festival') || t.includes('diwali') || t.includes('holi') || t.includes('navratri')) {
      icon = '🪔';
      if (!eventType) eventType = 'Festival';
    } else if (t.includes('pen drive') || t.includes('pendrive') || t.includes('archive')) {
      icon = '💾';
      if (!eventType) eventType = 'Pen Drive Archive';
    } else {
      icon = '📸';
      if (!eventType) eventType = 'Family Event';
    }

    // Infer Person
    if (!person) {
      if (t.includes('dhruv')) {
        person = 'Dhruv';
      } else if (t.includes('hir')) {
        person = 'HiR';
      } else if (t.includes('rinku')) {
        person = 'Rinku';
      }
    }

    // Infer Year (4 digits like 2024, 2025, 2026)
    if (!year) {
      const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        year = yearMatch[1];
      }
    }

    return { icon, eventType, person, year, date, location, description: '' };
  }

  /**
   * Helper to check for valid URL
   */
  static isValidUrl(string) {
    if (!string) return false;
    try {
      const url = new URL(string.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  /**
   * Helper to slugify string for IDs
   */
  static slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// Export for browser and node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoriesParser;
}
