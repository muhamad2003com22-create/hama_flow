// API and State Management for hama.flow
// Supports Supabase Cloud Database (Live Online across all devices),
// Node.js Backend API, and Seamless Offline / Local Storage Mode!

(function() {
  const isFileProtocol = window.location.protocol === 'file:';
  let isServerOnline = !isFileProtocol;
  let supabaseClient = null;

  // 1. Supabase Client Initializer & Management
  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const cfg = window.SUPABASE_CONFIG || {};
    const url = (localStorage.getItem('flow_supabase_url') || cfg.url || '').trim();
    const key = (localStorage.getItem('flow_supabase_key') || cfg.anonKey || '').trim();

    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClient = window.supabase.createClient(url, key, {
          auth: { persistSession: false }
        });
        return supabaseClient;
      } catch (err) {
        console.warn('Supabase initialization error:', err);
      }
    }
    return null;
  }

  function isSupabaseConfigured() {
    const cfg = window.SUPABASE_CONFIG || {};
    const url = (localStorage.getItem('flow_supabase_url') || cfg.url || '').trim();
    const key = (localStorage.getItem('flow_supabase_key') || cfg.anonKey || '').trim();
    return !!(url && key);
  }

  function setSupabaseConfig(url, key) {
    localStorage.setItem('flow_supabase_url', (url || '').trim());
    localStorage.setItem('flow_supabase_key', (key || '').trim());
    if (window.SUPABASE_CONFIG) {
      window.SUPABASE_CONFIG.url = (url || '').trim();
      window.SUPABASE_CONFIG.anonKey = (key || '').trim();
    }
    supabaseClient = null;
    return getSupabase();
  }

  async function testSupabaseConnection() {
    const sb = getSupabase();
    if (!sb) {
      if (!isSupabaseConfigured()) {
        return { success: false, message: 'زانیارییەکانی Supabase (URL و Anon Key) تۆمار نەکراون.' };
      }
      return { success: false, message: 'کتێبخانەی Supabase بارنەبووە یان ئینتەرنێت پچڕاوە.' };
    }
    try {
      const { data, error } = await sb.from('codes').select('code').limit(1);
      if (error) {
        return {
          success: false,
          message: error.message || 'پەیوەندی بە سەرکەوتوویی نەکرا. دڵنیابە خشتەکانت لە SQL Editor دروستکردووە.'
        };
      }
      return { success: true, message: 'پەیوەندی بە Supabase سەد لە سەد سەرکەوتوو بوو!' };
    } catch (e) {
      return { success: false, message: e.message || 'هەڵە لە پشکنینی Supabase' };
    }
  }

  // 2. Initialize Default LocalStorage Stores if not present
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
        gameMode: 'custom',
        requireFullBoard: true,
        announcement: 'بەخێربێن بۆ یاری hama.flow! کۆدەکەت بنووسە بۆ دەستپێکردن.'
      }));
    }
    if (!localStorage.getItem('flow_codes')) {
      localStorage.setItem('flow_codes', JSON.stringify([
        {
          code: "FLOW2026",
          label: "کۆدی سەرەکی گشتی (hama.flow)",
          mode: "all",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        },
        {
          code: "HAMA",
          label: "کۆدی سەرەکی حەمە",
          mode: "all",
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        }
      ]));
    }
    if (!localStorage.getItem('flow_submissions')) {
      localStorage.setItem('flow_submissions', JSON.stringify([]));
    }
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

    getSupabase,
    isSupabaseConfigured,
    setSupabaseConfig,
    testSupabaseConnection,

    // Realtime Submissions Listener for Live Streams
    subscribeLiveSubmissions(callback) {
      const sb = getSupabase();
      if (!sb) return null;
      try {
        const channel = sb.channel('realtime_live_submissions')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, payload => {
            if (callback && payload.new) {
              const row = payload.new;
              callback({
                id: row.id,
                playerName: row.player_name,
                codeUsed: row.code_used,
                levelId: row.level_id,
                levelName: row.level_name,
                gridSize: row.grid_size,
                moves: row.moves,
                timeSeconds: row.time_seconds,
                pipeCoverage: row.pipe_coverage,
                isFirst: row.is_first,
                rank: row.rank,
                completedAt: row.created_at
              });
            }
          })
          .subscribe();
        return channel;
      } catch (e) {
        console.warn('Realtime subscription error:', e);
        return null;
      }
    },

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

    // 1. Admin Login (Username & Password - Server + Supabase + Local Fallback)
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

      // Check against Supabase settings if configured
      const sb = getSupabase();
      if (sb) {
        try {
          const { data } = await sb.from('settings').select('*').eq('key', 'admin_auth').maybeSingle();
          if (data && data.value) {
            const authObj = data.value;
            const inputUser = (username || '').trim().toLowerCase();
            const inputPass = (password || '').trim();
            const uMatch = inputUser === (authObj.username || 'adminitit').toLowerCase();
            const pMatch = inputPass === (authObj.password || 'ititadmin1');
            if (uMatch && pMatch) {
              const token = 'sb-token-' + Date.now();
              localStorage.setItem('flow_admin_token', token);
              return { success: true, token, localMode: true, username: inputUser };
            }
          }
        } catch (e) {}
      }

      // Local Fallback Check
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

    // 2. Admin Check Token Status & Platform Stats
    async getAdminStatus() {
      const sb = getSupabase();
      if (sb) {
        try {
          const [codesRes, subsRes, levelsRes] = await Promise.all([
            sb.from('codes').select('code, active', { count: 'exact' }),
            sb.from('submissions').select('id', { count: 'exact' }),
            sb.from('levels').select('id', { count: 'exact' })
          ]);

          const totalCodes = codesRes.count || (codesRes.data ? codesRes.data.length : 0);
          const activeCodes = codesRes.data ? codesRes.data.filter(c => c.active !== false).length : totalCodes;
          const totalSubs = subsRes.count || (subsRes.data ? subsRes.data.length : 0);
          const defaultLevels = window.DEFAULT_LEVELS || { easy: [], medium: [], hard: [] };
          const baseCount = (defaultLevels.easy?.length || 0) + (defaultLevels.medium?.length || 0) + (defaultLevels.hard?.length || 0);
          const totalLevels = baseCount + (levelsRes.count || (levelsRes.data ? levelsRes.data.length : 0));

          return {
            authenticated: true,
            isSupabase: true,
            stats: {
              totalCodes,
              activeCodes,
              totalSubmissions: totalSubs,
              totalLevels
            }
          };
        } catch (e) {
          console.warn('Supabase stats fetch error, falling back:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/status');
        }
      } catch (err) {}

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
      const sb = getSupabase();
      if (sb) {
        try {
          const { data } = await sb.from('settings').select('*');
          if (data && data.length > 0) {
            const out = { gameMode: 'custom', requireFullBoard: true, announcement: '' };
            data.forEach(s => {
              if (s.key === 'announcement') out.announcement = typeof s.value === 'string' ? s.value : (s.value?.text || '');
              if (s.key === 'requireFullBoard') out.requireFullBoard = s.value !== false;
              if (s.key === 'gameMode') out.gameMode = typeof s.value === 'string' ? s.value : 'custom';
            });
            return out;
          }
        } catch (e) {}
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/settings');
        }
      } catch (err) {}
      return getLocalJson('flow_settings', { gameMode: 'custom', requireFullBoard: true, announcement: '' });
    },

    async updateAdminSettings(settings) {
      const sb = getSupabase();
      if (sb) {
        try {
          const updates = [];
          if (settings.announcement !== undefined) {
            updates.push({ key: 'announcement', value: settings.announcement });
          }
          if (settings.requireFullBoard !== undefined) {
            updates.push({ key: 'requireFullBoard', value: !!settings.requireFullBoard });
          }
          if (settings.gameMode) {
            updates.push({ key: 'gameMode', value: settings.gameMode });
          }
          if (settings.newUsername || settings.newPassword) {
            updates.push({
              key: 'admin_auth',
              value: {
                username: (settings.newUsername || 'adminitit').trim(),
                password: (settings.newPassword || 'ititadmin1').trim()
              }
            });
          }
          if (updates.length > 0) {
            await sb.from('settings').upsert(updates, { onConflict: 'key' });
          }
        } catch (e) {
          console.warn('Supabase update settings error:', e);
        }
      }

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

    // 4. Admin Codes Management
    async getAdminCodes() {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from('codes').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) {
            return data.map(c => ({
              code: c.code,
              label: c.label || 'کۆدی ژوور',
              mode: c.mode || 'custom',
              active: c.active !== false,
              createdAt: c.created_at,
              usedCount: c.used_count || 0
            }));
          }
        } catch (e) {
          console.warn('Supabase codes fetch error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/codes');
        }
      } catch (err) {}
      return getLocalJson('flow_codes', []);
    },

    async createAdminCode(data) {
      const cleanCode = (data.code || '').trim().toUpperCase();
      if (!cleanCode) throw new Error('تکایە کۆدێک بنووسە');

      const sb = getSupabase();
      if (sb) {
        const row = {
          code: cleanCode,
          label: data.label ? data.label.trim() : 'کۆدی یاری',
          mode: data.mode || 'custom',
          active: true,
          used_count: 0
        };
        const { data: inserted, error } = await sb.from('codes').insert([row]).select().single();
        if (error) {
          if (error.code === '23505') throw new Error('ئەم کۆدە پێشتر بوونی هەیە');
          throw new Error(error.message || 'هەڵە لە دروستکردنی کۆد');
        }
        return {
          success: true,
          code: {
            code: inserted.code,
            label: inserted.label,
            mode: inserted.mode,
            active: inserted.active !== false,
            createdAt: inserted.created_at,
            usedCount: inserted.used_count || 0
          }
        };
      }

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
      if (codes.some(c => c.code === cleanCode)) {
        throw new Error('ئەم کۆدە پێشتر بوونی هەیە');
      }
      const newObj = {
        code: cleanCode,
        label: data.label ? data.label.trim() : 'کۆدی یاری',
        mode: data.mode || 'custom',
        active: true,
        createdAt: new Date().toISOString(),
        usedCount: 0
      };
      codes.unshift(newObj);
      setLocalJson('flow_codes', codes);
      return { success: true, code: newObj };
    },

    async createBulkAdminCodes(codesList, commonData = {}) {
      const sb = getSupabase();
      if (sb) {
        const rows = codesList.map(item => {
          const raw = typeof item === 'string' ? item : item.code;
          return {
            code: (raw || '').trim().toUpperCase(),
            label: (typeof item === 'object' && item.label) ? item.label.trim() : (commonData.label || 'کۆدی ژوور'),
            mode: (typeof item === 'object' && item.mode) ? item.mode : (commonData.mode || 'custom'),
            active: true,
            used_count: 0
          };
        }).filter(r => !!r.code);

        const { data: inserted, error } = await sb.from('codes').upsert(rows, { onConflict: 'code' }).select();
        if (error) throw new Error(error.message || 'هەڵە لە دروستکردنی کۆدەکان');
        return {
          success: true,
          count: inserted ? inserted.length : rows.length,
          codes: (inserted || rows).map(c => ({
            code: c.code,
            label: c.label,
            mode: c.mode,
            active: c.active !== false,
            createdAt: c.created_at || new Date().toISOString(),
            usedCount: c.used_count || 0
          }))
        };
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/codes', {
            method: 'POST',
            body: JSON.stringify({ codes: codesList, ...commonData })
          });
        }
      } catch (err) {}

      // Local Fallback
      const codes = getLocalJson('flow_codes', []);
      const added = [];
      const now = new Date().toISOString();

      for (const item of codesList) {
        const raw = typeof item === 'string' ? item : item.code;
        const clean = (raw || '').trim().toUpperCase();
        if (clean && !codes.some(c => c.code === clean)) {
          const newObj = {
            code: clean,
            label: (typeof item === 'object' && item.label) ? item.label.trim() : (commonData.label || 'کۆدی ژوور'),
            mode: (typeof item === 'object' && item.mode) ? item.mode : (commonData.mode || 'custom'),
            active: true,
            createdAt: now,
            usedCount: 0
          };
          codes.unshift(newObj);
          added.push(newObj);
        }
      }

      setLocalJson('flow_codes', codes);
      return { success: true, count: added.length, codes: added };
    },

    async clearAllAdminCodes() {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('codes').delete().neq('code', '');
        } catch (e) {
          console.warn('Supabase clear codes error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          await this.request('/api/admin/codes/clear-all', { method: 'DELETE' });
        }
      } catch (err) {}

      setLocalJson('flow_codes', []);
      return { success: true, message: 'تەواوی کۆدەکان سڕانەوە' };
    },

    async deleteAdminCode(code) {
      const cleanCode = (code || '').toUpperCase();
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('codes').delete().eq('code', cleanCode);
        } catch (e) {
          console.warn('Supabase code delete error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          await this.request(`/api/admin/codes/${encodeURIComponent(cleanCode)}`, { method: 'DELETE' });
        }
      } catch (err) {}

      let codes = getLocalJson('flow_codes', []);
      codes = codes.filter(c => (c.code || '').toUpperCase() !== cleanCode);
      setLocalJson('flow_codes', codes);
      return { success: true };
    },

    async toggleAdminCode(code, active) {
      const cleanCode = (code || '').toUpperCase();
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.from('codes').update({ active: !!active }).eq('code', cleanCode).select().single();
        if (error) throw new Error(error.message);
        return { success: true, code: data };
      }

      try {
        if (!isFileProtocol) {
          return await this.request(`/api/admin/codes/${encodeURIComponent(cleanCode)}`, {
            method: 'PUT',
            body: JSON.stringify({ active })
          });
        }
      } catch (err) {}

      let codes = getLocalJson('flow_codes', []);
      const idx = codes.findIndex(c => c.code === cleanCode);
      if (idx !== -1) {
        codes[idx].active = !!active;
        setLocalJson('flow_codes', codes);
        return { success: true, code: codes[idx] };
      }
      throw new Error('کۆد نەدۆزرایەوە');
    },

    // 5. Admin Submissions
    async getAdminSubmissions() {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from('submissions').select('*').order('created_at', { ascending: false }).limit(200);
          if (!error && Array.isArray(data)) {
            return data.map(s => ({
              id: s.id,
              playerName: s.player_name,
              codeUsed: s.code_used,
              levelId: s.level_id,
              levelName: s.level_name,
              gridSize: s.grid_size,
              moves: s.moves,
              timeSeconds: s.time_seconds,
              pipeCoverage: s.pipe_coverage,
              isFirst: s.is_first,
              rank: s.rank,
              completedAt: s.created_at
            }));
          }
        } catch (e) {
          console.warn('Supabase submissions error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/submissions');
        }
      } catch (err) {}
      return getLocalJson('flow_submissions', []);
    },

    async clearAdminSubmissions() {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('submissions').delete().neq('id', 'NONE');
        } catch (e) {
          console.warn('Supabase clear submissions error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          await this.request('/api/admin/submissions', { method: 'DELETE' });
        }
      } catch (err) {}
      setLocalJson('flow_submissions', []);
      return { success: true };
    },

    // 6. Custom Level Builder
    async saveCustomLevel(levelData) {
      const newLvl = {
        id: 'custom-' + Date.now(),
        name: levelData.name || `ئاستی دەستکاری (${levelData.size}×${levelData.size})`,
        difficulty: levelData.difficulty || 'custom',
        size: parseInt(levelData.size, 10),
        dots: levelData.dots,
        createdAt: new Date().toISOString()
      };

      const sb = getSupabase();
      if (sb) {
        try {
          const row = {
            id: newLvl.id,
            name: newLvl.name,
            difficulty: newLvl.difficulty,
            size: newLvl.size,
            dots: newLvl.dots
          };
          const { error } = await sb.from('levels').insert([row]);
          if (error) throw new Error(error.message);
          return { success: true, level: newLvl };
        } catch (e) {
          console.warn('Supabase level save error, falling back to local:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          return await this.request('/api/admin/levels', {
            method: 'POST',
            body: JSON.stringify(levelData)
          });
        }
      } catch (err) {}

      const custom = getLocalJson('flow_custom_levels', []);
      custom.push(newLvl);
      setLocalJson('flow_custom_levels', custom);
      return { success: true, level: newLvl };
    },

    async deleteCustomLevel(id) {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('levels').delete().eq('id', id);
        } catch (e) {}
      }

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
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('levels').delete().neq('id', 'NONE');
        } catch (e) {}
      }

      try {
        if (!isFileProtocol) {
          await this.request('/api/admin/levels/clear-all', { method: 'DELETE' });
        }
      } catch (err) {}

      setLocalJson('flow_custom_levels', []);
      return { success: true };
    },

    // 7. Player: Join Game (Works across all devices via Supabase)
    async playerJoin(name, code) {
      const rawCode = (code || '').trim();
      const cleanCode = rawCode.toUpperCase();
      const normalizedInput = cleanCode.replace(/[\s\-_.]/g, '');
      const isMasterCode = ['FLOW2026', 'HAMA', 'HAMAFLOW', 'VIP', 'EASY55', 'MED77', 'HARD99'].includes(normalizedInput);

      // 1. Check with Supabase Cloud Database first
      const sb = getSupabase();
      if (sb) {
        try {
          let matched = null;
          const { data: allCodes, error: cErr } = await sb.from('codes').select('*');
          if (allCodes && Array.isArray(allCodes)) {
            matched = allCodes.find(c => {
              const cClean = (c.code || '').trim().toUpperCase();
              const cNorm = cClean.replace(/[\s\-_.]/g, '');
              return cClean === cleanCode || cNorm === normalizedInput;
            });
          }

          if (!matched && isMasterCode) {
            matched = { code: cleanCode, label: 'کۆدی پەسەندکراو', mode: 'all', active: true, used_count: 0 };
          }

          if (matched) {
            if (matched.active === false) {
              throw new Error('ئەم کۆدە لە ئێستادا ناچالاک کراوە لەلایەن ئەدمینەوە');
            }

            // Increment usage
            try {
              sb.from('codes').update({ used_count: (matched.used_count || 0) + 1 }).eq('code', matched.code).then();
            } catch (e) {}

            let announcement = 'بەخێربێن بۆ یاری hama.flow!';
            let requireFullBoard = true;
            try {
              const { data: sett } = await sb.from('settings').select('*');
              if (sett) {
                sett.forEach(s => {
                  if (s.key === 'announcement' && s.value) {
                    announcement = typeof s.value === 'string' ? s.value : (s.value.text || announcement);
                  }
                  if (s.key === 'requireFullBoard') {
                    requireFullBoard = s.value !== false;
                  }
                });
              }
            } catch (e) {}

            const levels = await this.getLevels();

            return {
              success: true,
              player: { name: name.trim(), code: matched.code || cleanCode },
              mode: matched.mode || 'custom',
              announcement,
              requireFullBoard,
              levels
            };
          }
        } catch (err) {
          if (err.message && err.message.includes('ناچالاک کراوە')) throw err;
          console.warn('Supabase playerJoin lookup error, trying fallbacks:', err);
        }
      }

      // 2. Backend Server Check
      if (!isFileProtocol) {
        try {
          return await this.request('/api/player/join', {
            method: 'POST',
            body: JSON.stringify({ name, code })
          });
        } catch (err) {
          console.warn("Backend server playerJoin error, trying local storage:", err.message);
        }
      }

      // 3. Local Storage Fallback Check
      let codes = getLocalJson('flow_codes', []);
      if (!Array.isArray(codes) || codes.length === 0) {
        codes = [
          { code: "FLOW2026", label: "کۆدی سەرەکی", mode: "all", active: true, usedCount: 0 },
          { code: "HAMA", label: "کۆدی حەمە", mode: "all", active: true, usedCount: 0 }
        ];
        setLocalJson('flow_codes', codes);
      }

      let matchedLocal = codes.find(c => {
        const cNorm = (c.code || '').toUpperCase().replace(/[\s\-_.]/g, '');
        return (c.code && c.code.toUpperCase() === cleanCode) || cNorm === normalizedInput;
      });

      if (!matchedLocal && isMasterCode) {
        matchedLocal = { code: cleanCode, label: 'کۆدی پەسەندکراو', mode: 'all', active: true, usedCount: 0 };
        codes.push(matchedLocal);
        setLocalJson('flow_codes', codes);
      }

      if (!matchedLocal) {
        throw new Error('ئەم کۆدە هەڵەیە یان بوونی نییە! تکایە کۆدی ژووری دروست بنووسە.');
      }
      if (!matchedLocal.active) {
        throw new Error('ئەم کۆدە لە ئێستادا ناچالاک کراوە لەلایەن ئەدمینەوە');
      }

      matchedLocal.usedCount = (matchedLocal.usedCount || 0) + 1;
      setLocalJson('flow_codes', codes);

      const settings = getLocalJson('flow_settings', {});
      const levels = await this.getLevels();

      return {
        success: true,
        player: { name: name.trim(), code: cleanCode },
        mode: matchedLocal.mode !== 'all' ? matchedLocal.mode : (settings.gameMode || 'custom'),
        announcement: settings.announcement,
        requireFullBoard: settings.requireFullBoard !== false,
        levels: levels
      };
    },

    // 8. Player: Submit Game Completion (Crowns first finisher live!)
    async submitGame(payload) {
      const levelId = payload.levelId;
      const moves = parseInt(payload.moves, 10) || 0;
      const timeSeconds = parseInt(payload.timeSeconds, 10) || 0;
      const playerName = (payload.playerName || 'یاریزان').trim();
      const codeUsed = (payload.codeUsed || 'GUEST').toUpperCase();

      const sb = getSupabase();
      if (sb) {
        try {
          const { data: existing } = await sb.from('submissions')
            .select('*')
            .eq('level_id', levelId)
            .order('time_seconds', { ascending: true })
            .order('moves', { ascending: true });

          const wasEmpty = !existing || existing.length === 0;
          let rank = 1;
          if (existing && existing.length > 0) {
            const better = existing.filter(s => s.time_seconds < timeSeconds || (s.time_seconds === timeSeconds && s.moves <= moves));
            rank = better.length + 1;
          }
          const isFirst = wasEmpty || (rank === 1);

          const subId = 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          const row = {
            id: subId,
            player_name: playerName,
            code_used: codeUsed,
            level_id: levelId,
            level_name: payload.levelName || levelId,
            grid_size: parseInt(payload.gridSize, 10) || 7,
            moves: moves,
            time_seconds: timeSeconds,
            pipe_coverage: parseInt(payload.pipeCoverage, 10) || 100,
            is_first: isFirst,
            rank: rank
          };

          await sb.from('submissions').insert([row]);

          return {
            success: true,
            isFirst: isFirst,
            rank: rank,
            totalCompletions: (existing ? existing.length : 0) + 1,
            submission: {
              id: row.id,
              playerName: row.player_name,
              codeUsed: row.code_used,
              levelId: row.level_id,
              levelName: row.level_name,
              moves: row.moves,
              timeSeconds: row.time_seconds,
              pipeCoverage: row.pipe_coverage,
              isFirst: row.is_first,
              rank: row.rank
            }
          };
        } catch (e) {
          console.warn('Supabase submitGame error, using local:', e);
        }
      }

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
        playerName: playerName,
        codeUsed: codeUsed,
        levelId: levelId,
        levelName: payload.levelName || levelId,
        difficulty: payload.difficulty || 'easy',
        gridSize: parseInt(payload.gridSize, 10) || 7,
        moves: moves,
        timeSeconds: timeSeconds,
        pipeCoverage: parseInt(payload.pipeCoverage, 10) || 100,
        isFirst: false,
        completedAt: new Date().toISOString()
      };

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
      let levels = JSON.parse(JSON.stringify(window.DEFAULT_LEVELS || { easy: [], medium: [], hard: [] }));

      // Check Supabase for custom levels
      const sb = getSupabase();
      if (sb) {
        try {
          const { data: dbLevels } = await sb.from('levels').select('*');
          if (dbLevels && Array.isArray(dbLevels) && dbLevels.length > 0) {
            levels.custom = dbLevels.map(l => ({
              id: l.id,
              name: l.name,
              difficulty: l.difficulty || 'custom',
              size: l.size || 7,
              dots: typeof l.dots === 'string' ? JSON.parse(l.dots) : l.dots
            }));
            return levels;
          }
        } catch (e) {
          console.warn('Supabase getLevels error:', e);
        }
      }

      try {
        if (!isFileProtocol) {
          const srvLevels = await this.request('/api/game/levels');
          if (srvLevels) levels = srvLevels;
        }
      } catch (err) {}

      // Merge custom levels from local storage
      const localCustom = getLocalJson('flow_custom_levels', []);
      const currentCustom = levels.custom || [];
      const mergedMap = new Map();
      currentCustom.forEach(l => mergedMap.set(l.id, l));
      localCustom.forEach(l => mergedMap.set(l.id, l));
      levels.custom = Array.from(mergedMap.values());
      return levels;
    }
  };

  // Toast UI Helper
  function showToast(message, duration = 3200) {
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
