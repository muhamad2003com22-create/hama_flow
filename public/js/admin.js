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

  // Builder
  const builderGridSize = document.getElementById('builderGridSize');
  const colorPalette = document.getElementById('colorPalette');
  const builderLevelName = document.getElementById('builderLevelName');
  const btnClearBuilderGrid = document.getElementById('btnClearBuilderGrid');
  const btnSaveCustomLevel = document.getElementById('btnSaveCustomLevel');
  const builderGrid = document.getElementById('builderGrid');
  const builderStatusText = document.getElementById('builderStatusText');
  const customLevelsTableBody = document.getElementById('customLevelsTableBody');

  // Submissions
  const submissionsTableBody = document.getElementById('submissionsTableBody');
  const btnClearSubmissions = document.getElementById('btnClearSubmissions');
  const btnSimulateSubmission = document.getElementById('btnSimulateSubmission');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const filterSubmissionsInput = document.getElementById('filterSubmissionsInput');

  // Pre-fill inputs with default credentials if empty
  if (adminUsernameInput && !adminUsernameInput.value) {
    adminUsernameInput.value = 'adminitit';
  }
  if (adminPasswordInput && !adminPasswordInput.value) {
    adminPasswordInput.value = 'ititadmin1';
  }

  // Check login on startup
  if (adminToken) {
    checkAdminAuth();
  }

  // Handle Login
  const doAdminLogin = async () => {
    const username = (adminUsernameInput ? adminUsernameInput.value.trim() : '') || 'adminitit';
    const password = adminPasswordInput.value.trim() || 'ititadmin1';
    try {
      const res = await API.adminLogin(username, password);
      if (res && res.token) {
        localStorage.setItem('flow_admin_token', res.token);
        adminToken = res.token;
        showToast('بە سەرکەوتوویی چوویتە ژوورەوە!');
        showDashboard();
      }
    } catch (err) {
      showToast(err.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە!');
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

  function showDashboard() {
    adminLoginSection.style.display = 'none';
    adminDashboardSection.style.display = 'block';
    btnAdminLogout.style.display = 'inline-flex';

    loadAllAdminData();
    initBuilderGrid();
    loadCustomLevelsList();
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

  // 3. Codes Management
  if (btnGenRandomCode) {
    btnGenRandomCode.addEventListener('click', () => {
      const prefixes = ['FLOW', 'VIP', 'CHALLENGE', 'PUZZLE', 'SMART'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const num = Math.floor(1000 + Math.random() * 9000);
      newCodeText.value = `${prefix}-${num}`;
    });
  }

  async function loadCodes() {
    try {
      loadedCodes = await API.getAdminCodes();
      renderCodesTable(loadedCodes);
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
      showToast('یارییە تایبەتەکە بە سەرکەوتوویی پاشەکەوت کرا! لە بەشی یاری زیاد بوو.');
      builderCells = {};
      builderLevelName.value = '';
      renderBuilderGrid();
      loadStats();
      loadCustomLevelsList();
    } catch (err) {
      showToast(err.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    }
  });

  async function loadCustomLevelsList() {
    if (!customLevelsTableBody) return;
    try {
      const levels = await API.getLevels();
      const custom = levels.custom || [];
      customLevelsTableBody.innerHTML = '';
      if (custom.length === 0) {
        customLevelsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">هێشتا هیچ یارییەکی دەستکاری دروست نەکراوە</td></tr>';
        return;
      }
      custom.forEach(lvl => {
        const tr = document.createElement('tr');
        const dateStr = lvl.createdAt ? new Date(lvl.createdAt).toLocaleDateString('ku') : '-';
        tr.innerHTML = `
          <td><strong>${lvl.name}</strong></td>
          <td>${lvl.size}×${lvl.size}</td>
          <td>${lvl.difficulty || 'medium'}</td>
          <td>${lvl.dots?.length || 0} جووت</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${dateStr}</td>
          <td>
            <button class="btn btn-danger btn-delete-custom-lvl" data-id="${lvl.id}" style="padding:3px 8px; font-size:0.8rem;">
              سڕینەوە
            </button>
          </td>
        `;
        customLevelsTableBody.appendChild(tr);
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
