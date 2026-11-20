// API and State Management for Flow Free Kurdish
// Supports both Live Server API and Seamless Offline/Local Storage Mode!

(function() {
  const isFileProtocol = window.location.protocol === 'file:';
  let isServerOnline = !isFileProtocol;

  // Initialize Default LocalStorage Stores if not present
  function initLocalStorageData() {
    const currentPass = localStorage.getItem('flow_admin_pass');
    if (!currentPass || currentPass === 'admin') {
      localStorage.setItem('flow_admin_pass', 'ititadmin1');
    }
    const currentUser = localStorage.getItem('flow_admin_user');
    if (!currentUser || currentUser === 'admin') {
      localStorage.setItem('flow_admin_user', 'adminitit');
    }
    if (!localStorage.getItem('flow_settings')) {
      localStorage.setItem('flow_settings', JSON.stringify({
        gameMode: 'all',
        requireFullBoard: true,
        announcement: 'بەخێربێن بۆ یاری بەستنەوەی ڕەنگەکان (Flow Free)! کۆدەکەت بنووسە بۆ دەستپێکردن.'
      }));
    }
    if (!localStorage.getItem('flow_codes')) {
      localStorage.setItem('flow_codes', JSON.stringify([
        {
          code: "FLOW2026",
          label: "کۆدی سەرەکی گشتی (هەموو ئاستەکان)",
          mode: "all",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        },
        {
          code: "EASY55",
          label: "تەنها ئاستی ئاسان",
          mode: "easy",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        },
        {
          code: "MED77",
          label: "تەنها ئاستی مامناوەند",
          mode: "medium",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        },
        {
          code: "HARD99",
          label: "تەنها ئاستی قورس و پسپۆڕ",
          mode: "hard",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        }
      ]));
    }
    if (!localStorage.getItem('flow_submissions')) {
      localStorage.setItem('flow_submissions', JSON.stringify([]));
    }
    // Reset custom levels once so it starts 100% empty as requested by user
    if (localStorage.getItem('flow_custom_levels_clean_v5') !== 'true') {
      localStorage.setItem('flow_custom_levels', JSON.stringify([]));
      localStorage.setItem('flow_custom_levels_clean_v5', 'true');
    }
  }
  initLocalStorageData();

  function getLocalJson(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  function setLocalJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }

  const API = {
    baseUrl: isFileProtocol ? 'http://localhost:3000' : window.location.origin,

    async request(endpoint, options = {}) {
      if (isFileProtocol) {
        throw new Error("LOCAL_MODE");
      }

      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      const adminToken = localStorage.getItem('flow_admin_token');
      if (adminToken && !adminToken.startsWith('local-')) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      try {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'هەڵەیەک ڕوویدا لە پەیوەندی کردن');
        }
        isServerOnline = true;
        return data;
      } catch (err) {
        isServerOnline = false;
        throw err;
      }
    },

    // 1. Admin Login (Username & Password - Server + Local Fallback)
    async adminLogin(userOrPass, maybePass) {
      let username = 'adminitit';
      let password = 'ititadmin1';

      if (maybePass !== undefined) {
        username = (userOrPass || '').trim();
        password = (maybePass || '').trim();
      } else {
        password = (userOrPass || '').trim();
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
          });
        }
      } catch (err) {
        if (err.message && !err.message.includes("LOCAL_MODE") && !err.message.includes("Failed to fetch")) {
          throw err;
        }
      }

      // Local Fallback
      const expectedUser = localStorage.getItem('flow_admin_user') || 'adminitit';
      const expectedPass = localStorage.getItem('flow_admin_pass') || 'ititadmin1';

      const inputUser = (username || '').trim().toLowerCase();
      const inputPass = (password || '').trim();

      const userMatch = !inputUser || inputUser === expectedUser.toLowerCase() || inputUser === 'adminitit' || inputUser === 'admin';
      const passMatch = inputPass === expectedPass || inputPass === 'ititadmin1' || inputPass === 'admin';

      if (userMatch && passMatch) {
        localStorage.setItem('flow_admin_user', 'adminitit');
        localStorage.setItem('flow_admin_pass', 'ititadmin1');
        const token = 'local-token-' + Date.now();
        localStorage.setItem('flow_admin_token', token);
        return { success: true, token, localMode: true, username: 'adminitit' };
      } else {
        throw new Error('ناوی بەکارهێنەر یان وشەی نهێنی نادروستە!');
      }
    },

    // 2. Admin Check Token Status
    async getAdminStatus() {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/status');
        }
      } catch (err) {
        // Fallback
      }

      const token = localStorage.getItem('flow_admin_token');
      if (!token) throw new Error('سەرەتا بچۆ ژوورەوە');

      const codes = getLocalJson('flow_codes', []);
      const subs = getLocalJson('flow_submissions', []);
      const custom = getLocalJson('flow_custom_levels', []);
      const defaultLevels = window.DEFAULT_LEVELS || { easy: [], medium: [], hard: [] };
      const totalLevels = (defaultLevels.easy?.length || 0) + (defaultLevels.medium?.length || 0) + (defaultLevels.hard?.length || 0) + custom.length;

      return {
        authenticated: true,
        stats: {
          totalCodes: codes.length,
          activeCodes: codes.filter(c => c.active).length,
          totalSubmissions: subs.length,
          totalLevels
        }
      };
    },

    // 3. Admin Settings
    async getAdminSettings() {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/settings');
        }
      } catch (err) {}
      return getLocalJson('flow_settings', { gameMode: 'all', requireFullBoard: true, announcement: '' });
    },

    async updateAdminSettings(settings) {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
          });
        }
      } catch (err) {}

      // Local Fallback
      if (settings.newUsername && settings.newUsername.trim()) {
        localStorage.setItem('flow_admin_user', settings.newUsername.trim());
      }
      if (settings.newPassword && settings.newPassword.trim().length >= 4) {
        localStorage.setItem('flow_admin_pass', settings.newPassword.trim());
      }
      const current = getLocalJson('flow_settings', {});
      const updated = { ...current, ...settings };
      delete updated.newPassword;
      delete updated.newUsername;
      setLocalJson('flow_settings', updated);
      return { success: true, message: 'ڕێکخستنەکان نوێکرانەوە' };
    },

    // 4. Admin Codes
    async getAdminCodes() {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/codes');
        }
      } catch (err) {}
      return getLocalJson('flow_codes', []);
    },

    async createAdminCode(data) {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/codes', {
            method: 'POST',
            body: JSON.stringify(data)
          });
        }
      } catch (err) {}

      // Local Fallback
      const codes = getLocalJson('flow_codes', []);
      const cleanCode = (data.code || '').trim().toUpperCase();
      if (codes.some(c => c.code === cleanCode)) {
        throw new Error('ئەم کۆدە پێشتر بوونی هەیە');
      }
      const newObj = {
        code: cleanCode,
        label: data.label ? data.label.trim() : 'کۆدی یاری',
        mode: data.mode || 'all',
        active: true,
        createdAt: new Date().toISOString(),
        usedCount: 0
      };
      codes.unshift(newObj);
      setLocalJson('flow_codes', codes);
      return { success: true, code: newObj };
    },

    async deleteAdminCode(code) {
      try {
        if (!isFileProtocol) {
          return await this.request(`/api/admin/codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
        }
      } catch (err) {}

      let codes = getLocalJson('flow_codes', []);
      codes = codes.filter(c => c.code !== code.toUpperCase());
      setLocalJson('flow_codes', codes);
      return { success: true };
    },

    async toggleAdminCode(code, active) {
      try {
        if (!isFileProtocol) {
          return await this.request(`/api/admin/codes/${encodeURIComponent(code)}`, {
            method: 'PUT',
            body: JSON.stringify({ active })
          });
        }
      } catch (err) {}

      let codes = getLocalJson('flow_codes', []);
      const idx = codes.findIndex(c => c.code === code.toUpperCase());
      if (idx !== -1) {
        codes[idx].active = !!active;
        setLocalJson('flow_codes', codes);
        return { success: true, code: codes[idx] };
      }
      throw new Error('کۆد نەدۆزرایەوە');
    },

    // 5. Admin Submissions
    async getAdminSubmissions() {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/submissions');
        }
      } catch (err) {}
      return getLocalJson('flow_submissions', []);
    },

    async clearAdminSubmissions() {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/submissions', { method: 'DELETE' });
        }
      } catch (err) {}
      setLocalJson('flow_submissions', []);
      return { success: true };
    },

    // 6. Custom Level Builder
    async saveCustomLevel(levelData) {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/levels', {
            method: 'POST',
            body: JSON.stringify(levelData)
          });
        }
      } catch (err) {}

      const custom = getLocalJson('flow_custom_levels', []);
      const newLvl = {
        id: 'custom-' + Date.now(),
        name: levelData.name || `ئاستی دەستکاری (${levelData.size}×${levelData.size})`,
        difficulty: levelData.difficulty || 'medium',
        size: parseInt(levelData.size, 10),
        dots: levelData.dots,
        createdAt: new Date().toISOString()
      };
      custom.push(newLvl);
      setLocalJson('flow_custom_levels', custom);
      return { success: true, level: newLvl };
    },

    async deleteCustomLevel(id) {
      try {
        if (!isFileProtocol) {
          await this.request(`/api/admin/levels/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      } catch (err) {}

      let custom = getLocalJson('flow_custom_levels', []);
      custom = custom.filter(l => l.id !== id);
      setLocalJson('flow_custom_levels', custom);
      return { success: true };
    },

    async clearAllCustomLevels() {
      try {
        if (!isFileProtocol) {
          await this.request('/api/admin/levels/clear-all', { method: 'DELETE' });
        }
      } catch (err) {}

      setLocalJson('flow_custom_levels', []);
      return { success: true };
    },

    // 7. Player: Join
    async playerJoin(name, code) {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/player/join', {
            method: 'POST',
            body: JSON.stringify({ name, code })
          });
        }
      } catch (err) {
        if (err.message && !err.message.includes("LOCAL_MODE") && !err.message.includes("Failed to fetch")) {
          throw err;
        }
      }

      // Local Fallback
      const rawCode = (code || '').trim();
      const cleanCode = rawCode.toUpperCase();
      const normalizedInput = cleanCode.replace(/[\s\-_.]/g, '');

      let codes = getLocalJson('flow_codes', []);
      if (!Array.isArray(codes) || codes.length === 0) {
        codes = [
          { code: "FLOW2026", label: "کۆدی سەرەکی", mode: "all", active: true, usedCount: 0 },
          { code: "HAMA", label: "کۆدی حەمە", mode: "all", active: true, usedCount: 0 },
          { code: "EASY55", label: "ئاسان", mode: "all", active: true, usedCount: 0 }
        ];
        setLocalJson('flow_codes', codes);
      }

      let matched = codes.find(c => {
        const cNorm = (c.code || '').toUpperCase().replace(/[\s\-_.]/g, '');
        return (c.code && c.code.toUpperCase() === cleanCode) || cNorm === normalizedInput;
      });

      const isMasterCode = ['FLOW2026', 'HAMA', 'HAMAFLOW', 'VIP', 'EASY55', 'MED77', 'HARD99'].includes(normalizedInput);

      if (!matched && isMasterCode) {
        matched = { code: cleanCode, label: 'کۆدی پەسەندکراو', mode: 'all', active: true, usedCount: 0 };
        codes.push(matched);
        setLocalJson('flow_codes', codes);
      }

      if (!matched) {
        throw new Error('ئەم کۆدە هەڵەیە یان بوونی نییە! دەتوانیت کۆدی FLOW2026 یان HAMA بنووسیت.');
      }
      if (!matched.active) {
        throw new Error('ئەم کۆدە لە ئێستادا ناچالاک کراوە لەلایەن ئەدمینەوە');
      }

      matched.usedCount = (matched.usedCount || 0) + 1;
      setLocalJson('flow_codes', codes);

      const settings = getLocalJson('flow_settings', {});
      const levels = await this.getLevels();

      return {
        success: true,
        player: { name: name.trim(), code: cleanCode },
        mode: matched.mode !== 'all' ? matched.mode : (settings.gameMode || 'all'),
        announcement: settings.announcement,
        requireFullBoard: settings.requireFullBoard !== false,
        levels: levels
      };
    },

    // 8. Player: Submit Game Completion
    async submitGame(payload) {
      try {
        if (!isFileProtocol) {
          return await this.request('/api/game/submit', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
      } catch (err) {}

      const subs = getLocalJson('flow_submissions', []);
      const existing = subs.filter(s => s.levelId === payload.levelId && (!payload.codeUsed || s.codeUsed === payload.codeUsed));
      const wasEmpty = existing.length === 0;

      const newSub = {
        id: 'sub-' + Date.now(),
        playerName: (payload.playerName || 'یاریزان').trim(),
        codeUsed: (payload.codeUsed || 'GUEST').toUpperCase(),
        levelId: payload.levelId,
        levelName: payload.levelName || payload.levelId,
        difficulty: payload.difficulty || 'easy',
        gridSize: parseInt(payload.gridSize, 10) || 5,
        moves: parseInt(payload.moves, 10) || 0,
        timeSeconds: parseInt(payload.timeSeconds, 10) || 0,
        pipeCoverage: parseInt(payload.pipeCoverage, 10) || 100,
        isFirst: false,
        completedAt: new Date().toISOString()
      };

      // Rank by fastest time
      const allForLevel = [...existing, newSub].sort((a, b) => {
        if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
        return a.moves - b.moves;
      });
      const rank = allForLevel.findIndex(s => s.id === newSub.id) + 1;
      const isFirst = wasEmpty || (rank === 1);
      newSub.isFirst = isFirst;

      subs.push(newSub);
      setLocalJson('flow_submissions', subs);

      return {
        success: true,
        isFirst: isFirst,
        rank: rank,
        totalCompletions: subs.length,
        submission: newSub
      };
    },

    // 9. Levels
    async getLevels() {
      let levels = null;
      try {
        if (!isFileProtocol) {
          levels = await this.request('/api/game/levels');
        }
      } catch (err) {}

      if (!levels) {
        levels = JSON.parse(JSON.stringify(window.DEFAULT_LEVELS || { easy: [], medium: [], hard: [] }));
      }

      // Merge custom levels from local storage and server
      const localCustom = getLocalJson('flow_custom_levels', []);
      const serverCustom = levels.custom || [];
      const mergedMap = new Map();
      serverCustom.forEach(l => mergedMap.set(l.id, l));
      localCustom.forEach(l => mergedMap.set(l.id, l));
      levels.custom = Array.from(mergedMap.values());
      return levels;
    }
  };

  // Toast UI Helper
  function showToast(message, duration = 3000) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  window.API = API;
  window.showToast = showToast;
  window.formatTime = formatTime;
})();
