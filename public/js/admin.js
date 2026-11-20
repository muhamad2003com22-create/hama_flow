// Admin Panel Logic for Flow Free Kurdish
document.addEventListener('DOMContentLoaded', () => {

  // State
  let adminToken = localStorage.getItem('flow_admin_token');
  let currentBuilderSize = 7;
  let selectedColor = '#ef4444';
  let builderCells = {}; // "r,c" -> color
  let loadedCodes = [];
  let loadedSubmissions = [];

  // Elements
  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminDashboardSection = document.getElementById('adminDashboardSection');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminUsernameInput = document.getElementById('adminUsernameInput');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const btnRefreshData = document.getElementById('btnRefreshData');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Stats
  const statTotalCodes = document.getElementById('statTotalCodes');
  const statActiveCodes = document.getElementById('statActiveCodes');
  const statTotalSubs = document.getElementById('statTotalSubs');
  const statTotalLevels = document.getElementById('statTotalLevels');

  // Settings & Mode
  const gameModeForm = document.getElementById('gameModeForm');
  const announcementInput = document.getElementById('announcementInput');
  const requireFullBoardCheck = document.getElementById('requireFullBoardCheck');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const newAdminUsername = document.getElementById('newAdminUsername');
  const newAdminPassword = document.getElementById('newAdminPassword');

  // Codes
  const createCodeForm = document.getElementById('createCodeForm');
  const newCodeText = document.getElementById('newCodeText');
  const newCodeLabel = document.getElementById('newCodeLabel');
  const newCodeMode = document.getElementById('newCodeMode');
  const btnGenRandomCode = document.getElementById('btnGenRandomCode');
  const filterCodesInput = document.getElementById('filterCodesInput');
  const codesTableBody = document.getElementById('codesTableBody');
  const bulkCodeForm = document.getElementById('bulkCodeForm');
  const bulkCountSelect = document.getElementById('bulkCountSelect');
  const bulkPrefixSelect = document.getElementById('bulkPrefixSelect');
  const bulkLabelInput = document.getElementById('bulkLabelInput');
  const btnCopyAllCodes = document.getElementById('btnCopyAllCodes');
  const btnClearAllCodes = document.getElementById('btnClearAllCodes');
  const codesCountBadge = document.getElementById('codesCountBadge');

  // Supabase Database Elements
  const supabaseConfigForm = document.getElementById('supabaseConfigForm');
  const supabaseUrlInput = document.getElementById('supabaseUrlInput');
  const supabaseKeyInput = document.getElementById('supabaseKeyInput');
  const supabaseStatusBadge = document.getElementById('supabaseStatusBadge');
  const btnTestSupabase = document.getElementById('btnTestSupabase');
  const btnCopySqlSetup = document.getElementById('btnCopySqlSetup');

  const SQL_SETUP_TEXT = `-- ========================================================
-- Supabase Schema for hama.flow Live Game Platform
-- ========================================================

-- 1. Codes Table (کۆدەکانی ژوور و یاری)
CREATE TABLE IF NOT EXISTS public.codes (
    code TEXT PRIMARY KEY,
    label TEXT DEFAULT 'کۆدی ژوور',
    mode TEXT DEFAULT 'custom',
    active BOOLEAN DEFAULT true,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Levels Table (ئاست و قۆناغە دروستکراوەکان)
CREATE TABLE IF NOT EXISTS public.levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    difficulty TEXT DEFAULT 'custom',
    size INTEGER DEFAULT 7,
    dots JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Submissions Table (ئەنجامەکان و کێ یەکەم بوو)
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    code_used TEXT NOT NULL,
    level_id TEXT NOT NULL,
    level_name TEXT,
    grid_size INTEGER DEFAULT 7,
    moves INTEGER DEFAULT 0,
    time_seconds INTEGER DEFAULT 0,
    pipe_coverage INTEGER DEFAULT 100,
    is_first BOOLEAN DEFAULT false,
    rank INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Settings Table (ڕێکخستنەکانی سیستەم و ڕاگەیاندن)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write codes" ON public.codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write levels" ON public.levels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- دانانی کۆدە سەرەتاییە هەمیشەییەکان
INSERT INTO public.codes (code, label, mode, active)
VALUES 
    ('FLOW2026', 'کۆدی سەرەکی پلاتفۆرم', 'all', true),
    ('HAMA', 'کۆدی سەرەکی حەمە', 'all', true)
ON CONFLICT (code) DO NOTHING;

-- چالاککردنی پەخشی ڕاستەوخۆ (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.codes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.levels;`;

  // Builder
  const builderGridSize = document.getElementById('builderGridSize');
  const colorPalette = document.getElementById('colorPalette');
  const builderLevelName = document.getElementById('builderLevelName');
  const btnClearBuilderGrid = document.getElementById('btnClearBuilderGrid');
  const btnSaveCustomLevel = document.getElementById('btnSaveCustomLevel');
  const builderGrid = document.getElementById('builderGrid');
  const builderStatusText = document.getElementById('builderStatusText');
  const customLevelsTableBody = document.getElementById('customLevelsTableBody');

  // Builder Instant Code & Hub Elements
  const builderAutoCreateCode = document.getElementById('builderAutoCreateCode');
  const builderCustomCodeInput = document.getElementById('builderCustomCodeInput');
  const btnBuilderRandomCode = document.getElementById('btnBuilderRandomCode');
  const builderActiveCodesContainer = document.getElementById('builderActiveCodesContainer');
  const btnBuilderCopyAllCodes = document.getElementById('btnBuilderCopyAllCodes');
  const btnBuilderQuickBulk10 = document.getElementById('btnBuilderQuickBulk10');

  // Success Modal Elements
  const builderSuccessModal = document.getElementById('builderSuccessModal');
  const modalGeneratedCodeText = document.getElementById('modalGeneratedCodeText');
  const modalLevelNameText = document.getElementById('modalLevelNameText');
  const btnModalCopyCode = document.getElementById('btnModalCopyCode');
  const btnModalClose = document.getElementById('btnModalClose');

  // Submissions
  const submissionsTableBody = document.getElementById('submissionsTableBody');
  const btnClearSubmissions = document.getElementById('btnClearSubmissions');
  const btnSimulateSubmission = document.getElementById('btnSimulateSubmission');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const filterSubmissionsInput = document.getElementById('filterSubmissionsInput');

  // Brute force protection state
  let failedLoginAttempts = 0;
  let loginLockoutUntil = 0;

  // Check login on startup
  if (adminToken) {
    checkAdminAuth();
  }

  // Handle Login
  const doAdminLogin = async () => {
    const now = Date.now();
    if (now < loginLockoutUntil) {
      const waitSec = Math.ceil((loginLockoutUntil - now) / 1000);
      showToast(`🔒 چوونەژوورەوە کاتییانە قوفڵکراوە بۆ پاراستن! تکایە ${waitSec} چرکە چاوەڕوان بە.`);
      return;
    }

    const username = (adminUsernameInput ? adminUsernameInput.value.trim() : '');
    const password = (adminPasswordInput ? adminPasswordInput.value.trim() : '');

    if (!username || !password) {
      showToast('تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە!');
      return;
    }

    try {
      const res = await API.adminLogin(username, password);
      if (res && res.token) {
        failedLoginAttempts = 0;
        localStorage.setItem('flow_admin_token', res.token);
        adminToken = res.token;
        if (adminPasswordInput) adminPasswordInput.value = '';
        showToast('بە سەرکەوتوویی چوویتە ژوورەوە!');
        showDashboard();
      }
    } catch (err) {
      failedLoginAttempts++;
      if (failedLoginAttempts >= 5) {
        loginLockoutUntil = Date.now() + 60000; // 60 seconds lockout
        showToast('🔒 ٥ جار هەڵەت لێدا! سیستەم بۆ ماوەی ١ خولەک قوفڵ بوو بۆ پاراستنی ئەمنیەتی.');
      } else {
        showToast(err.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە!');
      }
    }
  };

  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    doAdminLogin();
  });

  const btnAdminSubmitLogin = document.getElementById('btnAdminSubmitLogin');
  if (btnAdminSubmitLogin) {
    btnAdminSubmitLogin.addEventListener('click', (e) => {
      e.preventDefault();
      doAdminLogin();
    });
  }

  // Logout
  btnAdminLogout.addEventListener('click', async () => {
    try {
      await API.request('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('flow_admin_token');
    adminToken = null;
    adminDashboardSection.style.display = 'none';
    adminLoginSection.style.display = 'block';
    btnAdminLogout.style.display = 'none';
    showToast('دەرچوویت لە پانێڵی ئەدمین');
  });

  async function checkAdminAuth() {
    try {
      await API.getAdminStatus();
      showDashboard();
    } catch (e) {
      localStorage.removeItem('flow_admin_token');
      adminToken = null;
      adminDashboardSection.style.display = 'none';
      adminLoginSection.style.display = 'block';
      btnAdminLogout.style.display = 'none';
    }
  }

  async function updateSupabaseUI() {
    if (!supabaseStatusBadge) return;
    const cfg = window.SUPABASE_CONFIG || {};
    const url = localStorage.getItem('flow_supabase_url') || cfg.url || '';
    const key = localStorage.getItem('flow_supabase_key') || cfg.anonKey || '';

    if (supabaseUrlInput) supabaseUrlInput.value = url;
    if (supabaseKeyInput) supabaseKeyInput.value = key;

    if (!url || !key) {
      supabaseStatusBadge.textContent = '⚪ داتابەیسی ناوخۆیی (کۆدەکان تەنها لەم ئامێرە کار دەکەن)';
      supabaseStatusBadge.style.background = '#374151';
      supabaseStatusBadge.style.color = '#9ca3af';
      return;
    }

    supabaseStatusBadge.textContent = '⏳ پشکنینی پەیوەندی بە Supabase...';
    supabaseStatusBadge.style.background = '#854d0e';
    supabaseStatusBadge.style.color = '#fef08a';

    const res = await API.testSupabaseConnection();
    if (res.success) {
      supabaseStatusBadge.textContent = '🟢 پەیوەستە بە Supabase (ڕاستەوخۆ بۆ هەموو مۆبایلەکان)';
      supabaseStatusBadge.style.background = '#065f46';
      supabaseStatusBadge.style.color = '#6ee7b7';
    } else {
      supabaseStatusBadge.textContent = '🔴 کێشە لە پەیوەندی بە Supabase';
      supabaseStatusBadge.style.background = '#7f1d1d';
      supabaseStatusBadge.style.color = '#fca5a5';
    }
  }

  function showDashboard() {
    adminLoginSection.style.display = 'none';
    adminDashboardSection.style.display = 'block';
    btnAdminLogout.style.display = 'inline-flex';

    updateSupabaseUI();
    loadAllAdminData();
    initBuilderGrid();
    loadCustomLevelsList();

    // Setup Supabase Realtime Live Submissions listener
    if (!window._sbLiveSubscribed) {
      window._sbLiveSubscribed = true;
      API.subscribeLiveSubmissions((newSub) => {
        // Prepend to submissions table in real-time without reloading
        const exists = loadedSubmissions.some(s => s.id === newSub.id);
        if (!exists) {
          loadedSubmissions.unshift(newSub);
          renderSubmissionsTable(loadedSubmissions);
          loadStats();
          if (newSub.isFirst) {
            showToast(`👑 پیرۆزە! ${newSub.playerName} یەکەم بوو بە کاتی ${formatTime(newSub.timeSeconds)}!`, 6000);
          } else {
            showToast(`🏆 یاریزانی نوێ: ${newSub.playerName} کات: ${formatTime(newSub.timeSeconds)}`, 3500);
          }
        }
      });
    }
  }

  // Refresh
  btnRefreshData.addEventListener('click', () => {
    loadAllAdminData();
    loadCustomLevelsList();
    showToast('زانیارییەکان نوێکرانەوە');
  });

  // Tabs Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  async function loadAllAdminData() {
    try { await loadStats(); } catch (e) { console.warn('Stats error:', e); }
    try { await loadSettings(); } catch (e) { console.warn('Settings error:', e); }
    try { await loadCodes(); } catch (e) { console.warn('Codes error:', e); }
    try { await loadSubmissions(); } catch (e) { console.warn('Submissions error:', e); }
  }

  // 1. Stats
  async function loadStats() {
    try {
      const res = await API.getAdminStatus();
      if (res.stats) {
        statTotalCodes.textContent = res.stats.totalCodes || 0;
        statActiveCodes.textContent = res.stats.activeCodes || 0;
        statTotalSubs.textContent = res.stats.totalSubmissions || 0;
        statTotalLevels.textContent = res.stats.totalLevels || 0;
      }
    } catch (e) {
      console.warn('Error fetching stats:', e);
    }
  }

  // 2. Settings & Mode
  async function loadSettings() {
    try {
      const s = await API.getAdminSettings();
      if (s.announcement !== undefined) announcementInput.value = s.announcement;
      requireFullBoardCheck.checked = s.requireFullBoard !== false;
      if (s.adminUsername && newAdminUsername) {
        newAdminUsername.value = s.adminUsername;
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
  }

  gameModeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const gameMode = 'custom';
    const announcement = announcementInput.value.trim();
    const requireFullBoard = requireFullBoardCheck.checked;

    try {
      await API.updateAdminSettings({
        gameMode,
        announcement,
        requireFullBoard
      });
      showToast('ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوت کران!');
      loadStats();
    } catch (err) {
      showToast(err.message || 'هەڵەیەک ڕوویدا');
    }
  });

  // Change Username & Password
  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = newAdminUsername ? newAdminUsername.value.trim() : '';
    const newPass = newAdminPassword.value.trim();

    if (!newUsername && !newPass) {
      showToast('تکایە ناوی بەکارهێنەر یان وشەی نهێنی نوێ بنووسە');
      return;
    }

    if (newPass && newPass.length < 4) {
      showToast('وشەی نهێنی دەبێت لانیکەم ٤ پیت بێت');
      return;
    }

    try {
      const payload = {};
      if (newUsername) payload.newUsername = newUsername;
      if (newPass) payload.newPassword = newPass;

      await API.updateAdminSettings(payload);
      if (newPass) newAdminPassword.value = '';
      showToast('زانیارییەکانی چوونەژوورەوەی ئەدمین بە سەرکەوتوویی نوێکرانەوە!');
    } catch (err) {
      showToast(err.message || 'هەڵەیەک ڕوویدا');
    }
  });

  // Supabase Configuration Form Events
  if (supabaseConfigForm) {
    supabaseConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = (supabaseUrlInput ? supabaseUrlInput.value : '').trim();
      const key = (supabaseKeyInput ? supabaseKeyInput.value : '').trim();
      API.setSupabaseConfig(url, key);
      showToast('زانیارییەکانی Supabase پاشەکەوت کران!');
      await updateSupabaseUI();
      loadAllAdminData();
    });
  }

  if (btnTestSupabase) {
    btnTestSupabase.addEventListener('click', async () => {
      const url = (supabaseUrlInput ? supabaseUrlInput.value : '').trim();
      const key = (supabaseKeyInput ? supabaseKeyInput.value : '').trim();
      API.setSupabaseConfig(url, key);
      const res = await API.testSupabaseConnection();
      showToast(res.message);
      await updateSupabaseUI();
    });
  }

  if (btnCopySqlSetup) {
    btnCopySqlSetup.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SQL_SETUP_TEXT);
        showToast('📋 تەواوی کۆدی SQL کۆپی کرا! لە Supabase SQL Editor دایبنێ و Run لێبدە.');
      } catch (err) {
        showToast('تکایە فایلی supabase_setup.sql لە فۆڵدەرەکە بکەرەوە و کۆدی ناوەوەی کۆپی بکە');
      }
    });
  }

  // 3. Codes Management Helper
  function generateRandomRoomCode(prefix = 'MIX') {
    const prefixes = ['ROOM', 'HAMA', 'VIP', 'FLOW', 'GAME', 'SMART'];
    const p = prefix === 'MIX' ? prefixes[Math.floor(Math.random() * prefixes.length)] : prefix;
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${p}-${num}`;
  }

  if (btnGenRandomCode) {
    btnGenRandomCode.addEventListener('click', () => {
      newCodeText.value = generateRandomRoomCode('MIX');
    });
  }

  // Bulk Code Generation
  if (bulkCodeForm) {
    bulkCodeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(bulkCountSelect.value, 10) || 10;
      const prefix = bulkPrefixSelect.value || 'MIX';
      const label = (bulkLabelInput.value.trim()) || `ژووری پێشبڕکێ (${prefix})`;

      const generated = new Set();
      const existing = new Set((loadedCodes || []).map(c => c.code.toUpperCase()));

      let safety = 0;
      while (generated.size < count && safety < count * 20) {
        safety++;
        const c = generateRandomRoomCode(prefix);
        if (!existing.has(c)) {
          generated.add(c);
        }
      }

      const codesArray = Array.from(generated).map(code => ({
        code,
        label,
        mode: 'custom'
      }));

      try {
        const res = await API.createBulkAdminCodes(codesArray, { label, mode: 'custom' });
        showToast(`🎉 ${res.count || codesArray.length} کۆدی نوێی هەڕەمەکی بە سەرکەوتوویی دروستکران!`);
        bulkLabelInput.value = '';
        loadCodes();
        loadStats();
      } catch (err) {
        showToast(err.message || 'هەڵەیەک ڕوویدا لە دروستکردنی کۆدەکان');
      }
    });
  }

  // Copy All Codes
  if (btnCopyAllCodes) {
    btnCopyAllCodes.addEventListener('click', () => {
      if (!loadedCodes || loadedCodes.length === 0) {
        showToast('هیچ کۆدێک نییە بۆ کۆپیکردن');
        return;
      }
      const activeCodes = loadedCodes.filter(c => c.active !== false).map((c, i) => `${i + 1}. ${c.code} (${c.label || 'کۆدی ژوور'})`);
      const gameUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
      const textToCopy = `🎮 کۆدەکانی ژووری یاری hama.flow:\n` +
        activeCodes.join('\n') +
        `\n\n🌐 لینکی چوونەژوورەوەی یاری:\n${gameUrl}`;

      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`📋 هەموو کۆدەکان (${activeCodes.length} کۆد) کۆپیکران بۆ کلیپبۆرد!`);
      }).catch(() => {
        prompt('کۆدەکان کۆپی بکە:', activeCodes.join(', '));
      });
    });
  }

  // Clear All Codes
  if (btnClearAllCodes) {
    btnClearAllCodes.addEventListener('click', async () => {
      if (!loadedCodes || loadedCodes.length === 0) {
        showToast('هیچ کۆدێک نییە بۆ سڕینەوە');
        return;
      }
      if (confirm(`⚠️ دڵنیایت لە سڕینەوەی هەموو کۆدەکان (${loadedCodes.length} کۆد)؟ ئەم کردارە ناگەڕێتەوە!`)) {
        try {
          await API.clearAllAdminCodes();
          showToast('تەواوی کۆدەکان بە سەرکەوتوویی سڕانەوە!');
          loadCodes();
          loadStats();
        } catch (err) {
          showToast(err.message || 'هەڵەیەک ڕوویدا');
        }
      }
    });
  }

  async function loadCodes() {
    try {
      loadedCodes = await API.getAdminCodes();
      renderCodesTable(loadedCodes);
      renderBuilderActiveCodes();
    } catch (e) {
      console.warn('Error loading codes:', e);
    }
  }

  if (filterCodesInput) {
    filterCodesInput.addEventListener('input', () => {
      const q = filterCodesInput.value.trim().toLowerCase();
      if (!q) {
        renderCodesTable(loadedCodes);
        return;
      }
      const filtered = loadedCodes.filter(c => 
        c.code.toLowerCase().includes(q) || (c.label && c.label.toLowerCase().includes(q))
      );
      renderCodesTable(filtered);
    });
  }

  function renderCodesTable(codes) {
    codesTableBody.innerHTML = '';
    if (codesCountBadge) codesCountBadge.textContent = codes ? codes.length : 0;
    if (!codes || codes.length === 0) {
      codesTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">هیچ کۆدێک نەدۆزرایەوە</td></tr>';
      return;
    }

    codes.forEach(c => {
      const tr = document.createElement('tr');
      const modeLabels = {
        all: 'هەموو ئاستەکان',
        easy: 'ئاستی ئاسان',
        medium: 'ئاستی مامناوەند',
        hard: 'ئاستی قورس',
        custom: '🟣 یارییە تایبەتەکان'
      };

      tr.innerHTML = `
        <td>
          <span class="code-pill">${c.code}</span>
          <button class="btn btn-secondary btn-copy-code" data-code="${c.code}" style="padding:2px 6px; font-size:0.75rem; margin-right:4px;" title="کۆپیکردنی کۆد">
            📋 کۆپی
          </button>
        </td>
        <td>${c.label || '-'}</td>
        <td>${modeLabels[c.mode] || c.mode}</td>
        <td><strong>${c.usedCount || 0}</strong> جار</td>
        <td>
          <span class="status-badge ${c.active ? 'active' : 'inactive'}">
            ${c.active ? 'چالاکە' : 'ناچالاکە'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-toggle-code" data-code="${c.code}" data-active="${c.active}" style="padding:4px 8px; font-size:0.8rem;">
              ${c.active ? 'ناچالاککردن' : 'چالاککردن'}
            </button>
            <button class="btn btn-danger btn-delete-code" data-code="${c.code}" style="padding:4px 8px; font-size:0.8rem;">
              سڕینەوە
            </button>
          </div>
        </td>
      `;
      codesTableBody.appendChild(tr);
    });

    // Copy action
    codesTableBody.querySelectorAll('.btn-copy-code').forEach(b => {
      b.addEventListener('click', () => {
        const code = b.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
          showToast(`کۆدی (${code}) کۆپیکرا بۆ کلیپبۆرد!`);
        }).catch(() => {
          showToast(`کۆد: ${code}`);
        });
      });
    });

    // Toggle action
    codesTableBody.querySelectorAll('.btn-toggle-code').forEach(b => {
      b.addEventListener('click', async () => {
        const code = b.dataset.code;
        const currentActive = b.dataset.active === 'true';
        try {
          await API.toggleAdminCode(code, !currentActive);
          showToast(`بارودۆخی کۆدی ${code} گۆڕدرا`);
          loadCodes();
        } catch (err) {
          showToast(err.message);
        }
      });
    });

    // Delete action
    codesTableBody.querySelectorAll('.btn-delete-code').forEach(b => {
      b.addEventListener('click', async () => {
        const code = b.dataset.code;
        if (confirm(`دڵنیایت لە سڕینەوەی کۆدی ${code}؟`)) {
          try {
            await API.deleteAdminCode(code);
            showToast(`کۆدی ${code} سڕایەوە`);
            loadCodes();
            loadStats();
          } catch (err) {
            showToast(err.message);
          }
        }
      });
    });
  }

  createCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = newCodeText.value.trim().toUpperCase();
    const label = newCodeLabel.value.trim();
    const mode = newCodeMode.value;

    if (!code) return;

    try {
      await API.createAdminCode({ code, label, mode });
      newCodeText.value = '';
      newCodeLabel.value = '';
      showToast(`کۆدی ${code} بە سەرکەوتوویی دروستکرا!`);
      loadCodes();
      loadStats();
    } catch (err) {
      showToast(err.message || 'هەڵەیەک ڕوویدا');
    }
  });

  // 4. Custom Level Builder
  builderGridSize.addEventListener('change', () => {
    currentBuilderSize = parseInt(builderGridSize.value, 10);
    initBuilderGrid();
  });

  colorPalette.addEventListener('click', (e) => {
    const colEl = e.target.closest('.palette-color');
    if (!colEl) return;
    colorPalette.querySelectorAll('.palette-color').forEach(p => p.classList.remove('selected'));
    colEl.classList.add('selected');
    selectedColor = colEl.dataset.color;
  });

  btnClearBuilderGrid.addEventListener('click', () => {
    if (confirm('دڵنیایت لە پاککردنەوەی بۆردەکە؟')) {
      builderCells = {};
      renderBuilderGrid();
    }
  });

  function initBuilderGrid() {
    builderCells = {};
    renderBuilderGrid();
  }

  function renderBuilderGrid() {
    builderGrid.innerHTML = '';
    builderGrid.style.gridTemplateColumns = `repeat(${currentBuilderSize}, 44px)`;

    let totalDots = 0;
    const colorCounts = {};

    for (let r = 0; r < currentBuilderSize; r++) {
      for (let c = 0; c < currentBuilderSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'builder-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        const cellColor = builderCells[`${r},${c}`];
        if (cellColor) {
          totalDots++;
          colorCounts[cellColor] = (colorCounts[cellColor] || 0) + 1;

          const dot = document.createElement('div');
          dot.className = 'builder-dot';
          dot.style.background = cellColor;
          dot.style.color = cellColor;
          cell.appendChild(dot);
        }

        cell.addEventListener('click', () => {
          const key = `${r},${c}`;
          if (builderCells[key]) {
            // Remove dot if clicking existing
            delete builderCells[key];
          } else {
            // Count how many dots of selectedColor already exist
            const sameColorCount = Object.values(builderCells).filter(col => col === selectedColor).length;
            if (sameColorCount >= 2) {
              showToast('هەر ڕەنگێک دەبێت تەنها ٢ خاڵ بێت (جووتێک). تکایە ڕەنگێکی تر هەڵبژێرە');
              return;
            }
            builderCells[key] = selectedColor;
          }
          renderBuilderGrid();
        });

        builderGrid.appendChild(cell);
      }
    }

    // Update status text
    let completedPairs = 0;
    Object.values(colorCounts).forEach(cnt => {
      if (cnt === 2) completedPairs++;
    });
    if (builderStatusText) {
      builderStatusText.textContent = `خاڵە دانراوەکان: ${totalDots} خاڵ (${completedPairs} جووت تەواوە)`;
    }
  }

  btnSaveCustomLevel.addEventListener('click', async () => {
    // Validate: each color used must have exactly 2 points
    const colorCounts = {};
    for (const [key, col] of Object.entries(builderCells)) {
      if (!colorCounts[col]) colorCounts[col] = [];
      const [r, c] = key.split(',').map(Number);
      colorCounts[col].push([r, c]);
    }

    const validDots = [];
    for (const [col, points] of Object.entries(colorCounts)) {
      if (points.length !== 2) {
        showToast(`ڕەنگی (${col}) پێویستە بە تەواوی ٢ خاڵ بێت، بەڵام ${points.length} خاڵی دانراوە!`);
        return;
      }
      validDots.push({
        color: col,
        name: 'ڕەنگ',
        p1: points[0],
        p2: points[1]
      });
    }

    if (validDots.length < 2) {
      showToast('پێویستە لانیکەم ٢ جووتە ڕەنگ دابنێیت بۆ دروستکردنی یاری');
      return;
    }

    const name = builderLevelName.value.trim() || `ئاستی دەستکاری (${currentBuilderSize}×${currentBuilderSize})`;
    const difficulty = currentBuilderSize <= 6 ? 'easy' : (currentBuilderSize <= 8 ? 'medium' : 'hard');

    try {
      const res = await API.saveCustomLevel({
        size: currentBuilderSize,
        name: name,
        difficulty: difficulty,
        dots: validDots
      });

      let createdCode = null;
      if (builderAutoCreateCode && builderAutoCreateCode.checked) {
        let codeText = (builderCustomCodeInput ? builderCustomCodeInput.value : '').trim().toUpperCase();
        if (!codeText) {
          const rand = Math.floor(100 + Math.random() * 900);
          codeText = `ROOM${rand}`;
        }
        try {
          await API.createAdminCode({
            code: codeText,
            label: `یاری: ${name}`,
            mode: 'custom'
          });
          createdCode = codeText;
        } catch (cErr) {
          console.warn("Auto-create code warning:", cErr);
        }
      }

      builderCells = {};
      builderLevelName.value = '';
      if (builderCustomCodeInput) builderCustomCodeInput.value = '';
      renderBuilderGrid();
      await loadStats();
      await loadCodes();
      await loadCustomLevelsList();
      renderBuilderActiveCodes();

      if (createdCode && builderSuccessModal) {
        modalGeneratedCodeText.textContent = createdCode;
        modalLevelNameText.textContent = `${name} (${currentBuilderSize}×${currentBuilderSize})`;
        builderSuccessModal.style.display = 'flex';
      } else {
        showToast('یارییە تایبەتەکە بە سەرکەوتوویی پاشەکەوت کرا!');
      }
    } catch (err) {
      showToast(err.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    }
  });

  // Modal Actions
  if (btnModalCopyCode) {
    btnModalCopyCode.addEventListener('click', async () => {
      const code = (modalGeneratedCodeText.textContent || '').trim();
      try {
        await navigator.clipboard.writeText(code);
        showToast(`📋 کۆدی ${code} کۆپی کرا بۆ لایڤ!`);
      } catch (e) {
        showToast(`کۆد: ${code}`);
      }
    });
  }

  if (btnModalClose) {
    btnModalClose.addEventListener('click', () => {
      if (builderSuccessModal) builderSuccessModal.style.display = 'none';
    });
  }

  if (builderSuccessModal) {
    builderSuccessModal.addEventListener('click', (e) => {
      if (e.target === builderSuccessModal) {
        builderSuccessModal.style.display = 'none';
      }
    });
  }

  if (btnBuilderRandomCode) {
    btnBuilderRandomCode.addEventListener('click', () => {
      const prefixes = ['ROOM', 'HAMA', 'FLOW', 'LIVE', 'VIP'];
      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
      const num = Math.floor(100 + Math.random() * 900);
      if (builderCustomCodeInput) {
        builderCustomCodeInput.value = `${p}${num}`;
      }
    });
  }

  // Builder Quick Codes Hub
  function renderBuilderActiveCodes() {
    if (!builderActiveCodesContainer) return;
    builderActiveCodesContainer.innerHTML = '';
    const active = (loadedCodes || []).filter(c => c.active !== false);
    if (active.length === 0) {
      builderActiveCodesContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">هیچ کۆدێکی چالاک نییە. لەسەرەوە کاتی دروستکردنی یاری کۆدی نوێ دروست دەبێت.</span>';
      return;
    }
    active.forEach(c => {
      const chip = document.createElement('div');
      chip.style.cssText = 'background: #1e293b; border: 1px solid #334155; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; font-family: monospace; font-size: 0.95rem; font-weight: 700; color: #38bdf8; cursor: pointer; transition: 0.2s;';
      chip.title = 'کلیک بکە بۆ کۆپیکردن';
      chip.innerHTML = `<span>${c.code}</span> <span style="font-size:0.75rem; color:#94a3b8; font-family:sans-serif; font-weight:normal;">(${c.usedCount || 0} یاری)</span> <span style="font-size:0.8rem;">📋</span>`;
      chip.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(c.code);
          showToast(`کۆدی ${c.code} کۆپی کرا!`);
        } catch(e) {}
      });
      builderActiveCodesContainer.appendChild(chip);
    });
  }

  if (btnBuilderCopyAllCodes) {
    btnBuilderCopyAllCodes.addEventListener('click', async () => {
      const active = (loadedCodes || []).filter(c => c.active !== false).map(c => c.code);
      if (active.length === 0) {
        showToast('هیچ کۆدێکی چالاک نییە بۆ کۆپیکردن');
        return;
      }
      const text = active.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        showToast(`📋 هەموو کۆدەکان (${active.length} کۆد) کۆپی کران!`);
      } catch (err) {
        showToast('نەتوانرا کۆپی بکرێت');
      }
    });
  }

  if (btnBuilderQuickBulk10) {
    btnBuilderQuickBulk10.addEventListener('click', async () => {
      const codes = [];
      const prefixes = ['ROOM', 'HAMA', 'LIVE', 'FLOW'];
      for (let i = 0; i < 10; i++) {
        const p = prefixes[Math.floor(Math.random() * prefixes.length)];
        const num = Math.floor(100 + Math.random() * 900);
        codes.push({
          code: `${p}${num}`,
          label: 'کۆدی خێرای لایڤ',
          mode: 'custom'
        });
      }
      try {
        await API.createBulkAdminCodes(codes);
        showToast('🎉 ١٠ کۆدی نوێی لایڤ دەستبەجێ دروستکران!');
        await loadCodes();
        await loadStats();
        renderBuilderActiveCodes();
      } catch(err) {
        showToast(err.message || 'هەڵە لە دروستکردن');
      }
    });
  }

  async function loadCustomLevelsList() {
    if (!customLevelsTableBody) return;
    try {
      const levels = await API.getLevels();
      const custom = levels.custom || [];
      customLevelsTableBody.innerHTML = '';
      if (custom.length === 0) {
        customLevelsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 16px;">هێشتا هیچ یارییەکی دەستکاری دروست نەکراوە</td></tr>';
        return;
      }
      custom.forEach(lvl => {
        const tr = document.createElement('tr');
        const dateStr = lvl.createdAt ? new Date(lvl.createdAt).toLocaleDateString('ku') : '-';
        
        // Find matching codes for this level if any
        const matchingCodes = (loadedCodes || []).filter(c => c.label && c.label.includes(lvl.name));
        let codeBadgeHtml = '';
        if (matchingCodes.length > 0) {
          codeBadgeHtml = matchingCodes.map(c => `
            <span style="background:rgba(59,130,246,0.18); border:1px solid #3b82f6; color:#93c5fd; padding:3px 8px; border-radius:6px; font-family:monospace; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; margin:2px;" title="کلیک بکە بۆ کۆپیکردن" class="btn-copy-code-inline" data-code="${c.code}">
              ${c.code} 📋
            </span>
          `).join('');
        } else {
          codeBadgeHtml = `<button class="btn btn-secondary btn-create-code-for-level" data-name="${lvl.name}" style="padding:3px 8px; font-size:0.75rem;">🎲 دروستکردنی کۆد</button>`;
        }

        tr.innerHTML = `
          <td><strong>${lvl.name}</strong></td>
          <td>${lvl.size}×${lvl.size}</td>
          <td>${lvl.difficulty || 'medium'}</td>
          <td>${lvl.dots?.length || 0} جووت</td>
          <td>${codeBadgeHtml}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${dateStr}</td>
          <td>
            <button class="btn btn-danger btn-delete-custom-lvl" data-id="${lvl.id}" style="padding:4px 10px; font-size:0.8rem;">
              🗑️ سڕینەوە
            </button>
          </td>
        `;
        customLevelsTableBody.appendChild(tr);
      });

      // Inline Copy Code
      customLevelsTableBody.querySelectorAll('.btn-copy-code-inline').forEach(el => {
        el.addEventListener('click', async () => {
          const c = el.dataset.code;
          try {
            await navigator.clipboard.writeText(c);
            showToast(`📋 کۆدی ${c} کۆپی کرا!`);
          } catch(e){}
        });
      });

      // Quick Code creation for level
      customLevelsTableBody.querySelectorAll('.btn-create-code-for-level').forEach(btn => {
        btn.addEventListener('click', async () => {
          const lvlName = btn.dataset.name;
          const num = Math.floor(100 + Math.random() * 900);
          const newCode = `ROOM${num}`;
          try {
            await API.createAdminCode({
              code: newCode,
              label: `یاری: ${lvlName}`,
              mode: 'custom'
            });
            showToast(`کۆدی ${newCode} دروستکرا بۆ ${lvlName}!`);
            await loadCodes();
            await loadCustomLevelsList();
            renderBuilderActiveCodes();
          } catch (err) {
            showToast(err.message || 'هەڵە لە دروستکردنی کۆد');
          }
        });
      });

      customLevelsTableBody.querySelectorAll('.btn-delete-custom-lvl').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.dataset.id;
          if (confirm('دڵنیایت لە سڕینەوەی ئەم یارییە؟')) {
            await API.deleteCustomLevel(id);
            showToast('یارییە تایبەتەکە سڕایەوە');
            loadCustomLevelsList();
            loadStats();
          }
        });
      });
    } catch (e) {
      console.warn('Error loading custom levels list:', e);
    }
  }

  const btnClearAllCustomLevels = document.getElementById('btnClearAllCustomLevels');
  if (btnClearAllCustomLevels) {
    btnClearAllCustomLevels.addEventListener('click', async () => {
      if (confirm('دڵنیایت لە سڕینەوەی هەموو یارییە تایبەتەکان؟ ئەم بەشە بە تەواوی بەتاڵ دەبێتەوە.')) {
        await API.clearAllCustomLevels();
        showToast('هەموو یارییە تایبەتەکان سڕانەوە و بەتاڵ کران!');
        loadCustomLevelsList();
        loadStats();
      }
    });
  }

  // 5. Submissions & Leaderboard
  async function loadSubmissions() {
    try {
      loadedSubmissions = await API.getAdminSubmissions();
      renderSubmissionsTable(loadedSubmissions);
    } catch (e) {
      console.warn('Error loading submissions:', e);
    }
  }

  if (filterSubmissionsInput) {
    filterSubmissionsInput.addEventListener('input', () => {
      const q = filterSubmissionsInput.value.trim().toLowerCase();
      if (!q) {
        renderSubmissionsTable(loadedSubmissions);
        return;
      }
      const filtered = loadedSubmissions.filter(s => 
        (s.playerName && s.playerName.toLowerCase().includes(q)) || 
        (s.codeUsed && s.codeUsed.toLowerCase().includes(q)) ||
        (s.levelName && s.levelName.toLowerCase().includes(q))
      );
      renderSubmissionsTable(filtered);
    });
  }

  function renderSubmissionsTable(subs) {
    submissionsTableBody.innerHTML = '';
    if (!subs || subs.length === 0) {
      submissionsTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">هێشتا هیچ یاریزانێک یاری تەواو نەکردووە</td></tr>';
      return;
    }

    // Sort newest first
    const sorted = [...subs].reverse();

    sorted.forEach(s => {
      const tr = document.createElement('tr');
      const dateStr = s.completedAt ? new Date(s.completedAt).toLocaleString('ku', { dateStyle: 'short', timeStyle: 'short' }) : '-';

      tr.innerHTML = `
        <td><strong>${s.playerName || 'یاریزان'}</strong></td>
        <td><span class="code-pill">${s.codeUsed || 'GUEST'}</span></td>
        <td>${s.levelName || s.levelId}</td>
        <td>${s.gridSize}×${s.gridSize}</td>
        <td style="color:#10b981; font-weight:700;">${formatTime(s.timeSeconds || 0)}</td>
        <td>${s.moves || 0}</td>
        <td>${s.pipeCoverage || 100}%</td>
        <td>
          ${s.isFirst ? '<span class="crown-badge">👑 یەکەم بوو!</span>' : '<span style="color:var(--text-muted);">تەواویکرد</span>'}
        </td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${dateStr}</td>
      `;
      submissionsTableBody.appendChild(tr);
    });
  }

  // Export CSV
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (!loadedSubmissions || loadedSubmissions.length === 0) {
        showToast('هیچ تۆمارێک نییە بۆ داگرتن');
        return;
      }
      let csvContent = '\uFEFF'; // UTF-8 BOM
      csvContent += 'ناوی یاریزان,کۆد,ئاست,سکیل,کات (چرکە),جووڵەکان,داپۆشین,یەکەم بوو,ڕێکەوت\n';
      loadedSubmissions.forEach(s => {
        csvContent += `"${s.playerName}","${s.codeUsed}","${s.levelName || s.levelId}","${s.gridSize}x${s.gridSize}",${s.timeSeconds},${s.moves},"${s.pipeCoverage}%","${s.isFirst ? 'بەڵێ' : 'نەخێر'}","${s.completedAt}"\n`;
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `flow_free_submissions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('ڕاپۆرتی ئەنجامەکان داگیرا!');
    });
  }

  if (btnSimulateSubmission) {
    btnSimulateSubmission.addEventListener('click', async () => {
      try {
        const dummyNames = ['ئارام سۆران', 'دڵنیا کاروان', 'ڕەوەند ئەحمەد', 'لانە هاوڕێ', 'هێمن زرار'];
        const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
        await API.submitGame({
          playerName: randomName,
          codeUsed: 'FLOW2026',
          levelId: 'easy-1',
          levelName: 'ئاسان ١ (٥×٥)',
          difficulty: 'easy',
          gridSize: 5,
          moves: Math.floor(Math.random() * 8) + 12,
          timeSeconds: Math.floor(Math.random() * 25) + 18,
          pipeCoverage: 100
        });
        showToast(`ئەنجامێکی نموونەیی تۆمارکرا بۆ (${randomName})!`);
        loadSubmissions();
        loadStats();
      } catch (err) {
        showToast(err.message || 'هەڵەیەک ڕوویدا');
      }
    });
  }

  btnClearSubmissions.addEventListener('click', async () => {
    if (confirm('دڵنیایت لە سڕینەوەی هەموو ئەنجامە تۆمارکراوەکان؟')) {
      try {
        await API.clearAdminSubmissions();
        showToast('هەموو تۆمارەکان بە سەرکەوتوویی سڕانەوە');
        loadSubmissions();
        loadStats();
      } catch (err) {
        showToast(err.message);
      }
    }
  });

});
