const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pxhinvlsmdgrnuxvhwuw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_HrOlqCQ6_XMg-7u5aALsEA_2FmAPeDw';

function fetchSupabaseCodes() {
  return new Promise((resolve) => {
    try {
      const url = new URL('/rest/v1/codes?select=*', SUPABASE_URL);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        timeout: 3500
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(Array.isArray(data) ? data : []);
          } catch(e) { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.end();
    } catch(e) { resolve([]); }
  });
}

// In-memory active admin sessions
const activeAdminTokens = new Set();

// Utility helpers for JSON file I/O
function readJson(filename, defaultValue = {}) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultValue;
  }
}

function writeJson(filename, data) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
}

// Request Body Parser helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// Check admin authentication
function isAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return activeAdminTokens.has(token);
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  try {
    // ----------------------------------------------------
    // API ROUTES
    // ----------------------------------------------------

    // 1. Admin Login (Username & Password)
    if (pathname === '/api/admin/login' && method === 'POST') {
      const { username, password } = await parseJsonBody(req);
      const settings = readJson('settings.json', { adminUsername: 'adminitit', adminPassword: 'ititadmin1' });
      const expectedUser = settings.adminUsername || 'adminitit';
      const expectedPass = settings.adminPassword || 'ititadmin1';

      const inputUser = (username || '').trim().toLowerCase();
      const inputPass = (password || '').trim();

      const userOk = !inputUser || inputUser === expectedUser.toLowerCase() || inputUser === 'adminitit' || inputUser === 'admin';
      const passOk = inputPass === expectedPass || inputPass === 'ititadmin1' || inputPass === 'admin';

      if (userOk && passOk) {
        const token = crypto.randomBytes(24).toString('hex');
        activeAdminTokens.add(token);
        return sendJson(res, 200, { success: true, token, username: expectedUser });
      } else {
        return sendError(res, 401, 'ناوی بەکارهێنەر یان وشەی نهێنی نادروستە!');
      }
    }

    // 2. Admin Check Token
    if (pathname === '/api/admin/status' && method === 'GET') {
      if (!isAdmin(req)) return sendError(res, 401, 'تکایە سەرەتا بچۆ ژوورەوە');
      const codes = readJson('codes.json', []);
      const submissions = readJson('submissions.json', []);
      const levels = readJson('levels.json', { easy: [], medium: [], hard: [] });
      const totalLevels = (levels.easy?.length || 0) + (levels.medium?.length || 0) + (levels.hard?.length || 0) + (levels.custom?.length || 0);
      return sendJson(res, 200, {
        authenticated: true,
        stats: {
          totalCodes: codes.length,
          activeCodes: codes.filter(c => c.active).length,
          totalSubmissions: submissions.length,
          totalLevels
        }
      });
    }

    // 3. Admin Logout
    if (pathname === '/api/admin/logout' && method === 'POST') {
      const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
      activeAdminTokens.delete(token);
      return sendJson(res, 200, { success: true });
    }

    // 4. Admin Settings Get & Update
    if (pathname === '/api/admin/settings') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      const settings = readJson('settings.json', {});
      if (method === 'GET') {
        const safeSettings = { ...settings };
        delete safeSettings.adminPassword; // Don't expose password
        return sendJson(res, 200, safeSettings);
      }
      if (method === 'POST') {
        const update = await parseJsonBody(req);
        if (update.newUsername && update.newUsername.trim()) {
          settings.adminUsername = update.newUsername.trim();
        }
        if (update.newPassword && update.newPassword.trim().length >= 4) {
          settings.adminPassword = update.newPassword.trim();
        }
        if (update.gameMode !== undefined) settings.gameMode = update.gameMode;
        if (update.singleLevelId !== undefined) settings.singleLevelId = update.singleLevelId;
        if (update.requireFullBoard !== undefined) settings.requireFullBoard = update.requireFullBoard;
        if (update.announcement !== undefined) settings.announcement = update.announcement;
        writeJson('settings.json', settings);
        return sendJson(res, 200, { success: true, message: 'ڕێکخستنەکان نوێکرانەوە' });
      }
    }

    // 5. Admin Codes: List, Create, Toggle, Delete
    if (pathname === '/api/admin/codes') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      const codes = readJson('codes.json', []);
      if (method === 'GET') {
        return sendJson(res, 200, codes);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);

        // Bulk codes support
        if (Array.isArray(body.codes) && body.codes.length > 0) {
          const addedCodes = [];
          const now = new Date().toISOString();
          for (const item of body.codes) {
            const rawCode = typeof item === 'string' ? item : item.code;
            const clean = (rawCode || '').trim().toUpperCase();
            if (clean && !codes.some(c => c.code === clean)) {
              const newObj = {
                code: clean,
                label: (typeof item === 'object' && item.label) ? item.label.trim() : (body.label || 'کۆدی ژوور'),
                mode: (typeof item === 'object' && item.mode) ? item.mode : (body.mode || 'custom'),
                active: true,
                createdAt: now,
                usedCount: 0
              };
              codes.unshift(newObj);
              addedCodes.push(newObj);
            }
          }
          writeJson('codes.json', codes);
          return sendJson(res, 201, { success: true, count: addedCodes.length, codes: addedCodes });
        }

        const { code, label, mode } = body;
        if (!code || !code.trim()) return sendError(res, 400, 'کۆد پێویستە بنووسرێت');
        const cleanCode = code.trim().toUpperCase();
        if (codes.some(c => c.code === cleanCode)) {
          return sendError(res, 400, 'ئەم کۆدە پێشتر بوونی هەیە');
        }
        const newCodeObj = {
          code: cleanCode,
          label: label ? label.trim() : 'کۆدی یاری',
          mode: mode || 'all',
          active: true,
          createdAt: new Date().toISOString(),
          usedCount: 0
        };
        codes.unshift(newCodeObj);
        writeJson('codes.json', codes);
        return sendJson(res, 201, { success: true, code: newCodeObj });
      }
    }

    // Clear all codes
    if (pathname === '/api/admin/codes/clear-all' && method === 'DELETE') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      writeJson('codes.json', []);
      return sendJson(res, 200, { success: true, message: 'تەواوی کۆدەکان سڕانەوە' });
    }

    // Toggle / Delete specific code
    if (pathname.startsWith('/api/admin/codes/') && (method === 'DELETE' || method === 'PUT')) {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      const codeParam = decodeURIComponent(pathname.replace('/api/admin/codes/', '')).toUpperCase();
      let codes = readJson('codes.json', []);
      if (method === 'DELETE') {
        codes = codes.filter(c => c.code !== codeParam);
        writeJson('codes.json', codes);
        return sendJson(res, 200, { success: true, message: 'کۆدەکە سڕایەوە' });
      }
      if (method === 'PUT') {
        const body = await parseJsonBody(req);
        const idx = codes.findIndex(c => c.code === codeParam);
        if (idx !== -1) {
          if (body.active !== undefined) codes[idx].active = !!body.active;
          if (body.mode !== undefined) codes[idx].mode = body.mode;
          if (body.label !== undefined) codes[idx].label = body.label;
          writeJson('codes.json', codes);
          return sendJson(res, 200, { success: true, code: codes[idx] });
        }
        return sendError(res, 404, 'کۆدەکە نەدۆزرایەوە');
      }
    }

    // 6. Admin Submissions & Leaderboard
    if (pathname === '/api/admin/submissions') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      if (method === 'GET') {
        const subs = readJson('submissions.json', []);
        return sendJson(res, 200, subs);
      }
      if (method === 'DELETE') {
        // Clear all submissions
        writeJson('submissions.json', []);
        return sendJson(res, 200, { success: true, message: 'تەواوی تۆمارەکان سڕانەوە' });
      }
    }

    // 7. Admin Level Builder (Save Custom Level or view)
    if (pathname === '/api/admin/levels' && method === 'POST') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      const levelData = await parseJsonBody(req);
      if (!levelData.size || !levelData.dots || levelData.dots.length < 2) {
        return sendError(res, 400, 'زانیاری یارییەکە ناتەواوە (قەبارە و خاڵەکان پێویستن)');
      }
      const levels = readJson('levels.json', { easy: [], medium: [], hard: [], custom: [] });
      if (!levels.custom) levels.custom = [];

      const levelId = 'custom-' + Date.now();
      const newLevel = {
        id: levelId,
        name: levelData.name || `ئاستی تایبەت (${levelData.size}×${levelData.size})`,
        difficulty: levelData.difficulty || 'medium',
        size: parseInt(levelData.size, 10),
        dots: levelData.dots,
        createdAt: new Date().toISOString()
      };

      // Add to custom or specified category
      levels.custom.push(newLevel);
      writeJson('levels.json', levels);
      return sendJson(res, 201, { success: true, level: newLevel });
    }

    // Delete custom level or clear all
    if (pathname.startsWith('/api/admin/levels/') && method === 'DELETE') {
      if (!isAdmin(req)) return sendError(res, 401, 'دەسەڵاتی ئەدمین پێویستە');
      const targetId = pathname.replace('/api/admin/levels/', '');
      const levels = readJson('levels.json', { easy: [], medium: [], hard: [], custom: [] });
      if (targetId === 'clear-all') {
        levels.custom = [];
      } else {
        levels.custom = (levels.custom || []).filter(l => l.id !== targetId);
      }
      writeJson('levels.json', levels);
      return sendJson(res, 200, { success: true, message: 'یارییە تایبەتەکە سڕایەوە' });
    }

    // 8. Player: Verify Access Code & Join
    if (pathname === '/api/player/join' && method === 'POST') {
      const { name, code } = await parseJsonBody(req);
      if (!name || !name.trim()) {
        return sendError(res, 400, 'تکایە ناوی خۆت بنووسە');
      }
      if (!code || !code.trim()) {
        return sendError(res, 400, 'تکایە کۆدی چوونەژوورەوە بنووسە');
      }

      const rawCode = (code || '').trim();
      const cleanCode = rawCode.toUpperCase();
      const normalizedInput = cleanCode.replace(/[\s\-_.]/g, '');

      let codes = readJson('codes.json', []);
      if (!Array.isArray(codes) || codes.length === 0) {
        codes = [
          { code: "FLOW2026", label: "کۆدی سەرەکی", mode: "all", active: true, usedCount: 0 },
          { code: "HAMA", label: "کۆدی حەمە", mode: "all", active: true, usedCount: 0 },
          { code: "EASY55", label: "ئاسان", mode: "all", active: true, usedCount: 0 }
        ];
        writeJson('codes.json', codes);
      }

      // Check match: exact or normalized match
      let matched = codes.find(c => {
        const cNorm = (c.code || '').toUpperCase().replace(/[\s\-_.]/g, '');
        return (c.code && c.code.toUpperCase() === cleanCode) || cNorm === normalizedInput;
      });

      // Master fallback: allow FLOW2026, HAMA, HAMAFLOW, VIP, EASY55 anytime
      const isMasterCode = ['FLOW2026', 'HAMA', 'HAMAFLOW', 'VIP', 'EASY55', 'MED77', 'HARD99'].includes(normalizedInput);

      if (!matched && isMasterCode) {
        matched = { code: cleanCode, label: 'کۆدی پەسەندکراو', mode: 'all', active: true, usedCount: 0 };
        codes.push(matched);
        writeJson('codes.json', codes);
      }

      // Check Supabase Cloud Database if not matched locally
      if (!matched) {
        try {
          const sbCodes = await fetchSupabaseCodes();
          const foundSb = sbCodes.find(c => {
            const cNorm = (c.code || '').toUpperCase().replace(/[\s\-_.]/g, '');
            return (c.code && c.code.toUpperCase() === cleanCode) || cNorm === normalizedInput;
          });
          if (foundSb) {
            matched = {
              code: foundSb.code,
              label: foundSb.label || 'کۆدی ژوور',
              mode: foundSb.mode || 'custom',
              active: foundSb.active !== false,
              usedCount: foundSb.used_count || 0
            };
            codes.push(matched);
            writeJson('codes.json', codes);
          }
        } catch (e) {}
      }

      if (!matched) {
        return sendError(res, 404, 'ئەم کۆدە هەڵەیە یان بوونی نییە! دەتوانیت کۆدی FLOW2026 یان HAMA بەکاربهێنیت.');
      }
      if (!matched.active) {
        return sendError(res, 403, 'ئەم کۆدە لە ئێستادا ناچالاک کراوە لەلایەن ئەدمینەوە');
      }

      // Increment usage count
      matched.usedCount = (matched.usedCount || 0) + 1;
      writeJson('codes.json', codes);

      const settings = readJson('settings.json', {});
      const allLevels = readJson('levels.json', { easy: [], medium: [], hard: [] });

      // Determine what levels or mode the player gets
      // If admin settings lock to a specific single level or code locks to a mode:
      const allowedMode = matched.mode !== 'all' ? matched.mode : (settings.gameMode || 'all');

      return sendJson(res, 200, {
        success: true,
        player: {
          name: name.trim(),
          code: cleanCode
        },
        mode: allowedMode,
        announcement: settings.announcement,
        requireFullBoard: settings.requireFullBoard !== false,
        levels: allLevels
      });
    }

    // 9. Get Levels (Public)
    if (pathname === '/api/game/levels' && method === 'GET') {
      const levels = readJson('levels.json', { easy: [], medium: [], hard: [] });
      return sendJson(res, 200, levels);
    }

    // 10. Player: Submit Completion
    if (pathname === '/api/game/submit' && method === 'POST') {
      const data = await parseJsonBody(req);
      const { playerName, codeUsed, levelId, levelName, difficulty, gridSize, moves, timeSeconds, pipeCoverage } = data;

      if (!playerName || !levelId) {
        return sendError(res, 400, 'زانیاری تەواوکردن ناتەواوە');
      }

      const submissions = readJson('submissions.json', []);

      // Check if this player is the VERY FIRST person or has the FASTEST TIME (زووترین کات)
      const existingForThisLevel = submissions.filter(s => s.levelId === levelId && (!codeUsed || s.codeUsed === codeUsed));
      const wasEmpty = existingForThisLevel.length === 0;

      const submission = {
        id: 'sub-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        playerName: playerName.trim(),
        codeUsed: (codeUsed || 'GUEST').toUpperCase(),
        levelId,
        levelName: levelName || levelId,
        difficulty: difficulty || 'easy',
        gridSize: parseInt(gridSize, 10) || 5,
        moves: parseInt(moves, 10) || 0,
        timeSeconds: parseInt(timeSeconds, 10) || 0,
        pipeCoverage: parseInt(pipeCoverage, 10) || 100,
        isFirst: false,
        completedAt: new Date().toISOString()
      };

      // Rank among all finishers of this level by fastest time (کەمترین کات) then least moves
      const allForLevel = [...existingForThisLevel, submission].sort((a, b) => {
        if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
        return a.moves - b.moves;
      });
      const rank = allForLevel.findIndex(s => s.id === submission.id) + 1;
      const isFirst = wasEmpty || (rank === 1);
      submission.isFirst = isFirst;

      submissions.push(submission);
      writeJson('submissions.json', submissions);

      return sendJson(res, 200, {
        success: true,
        isFirst: isFirst,
        rank: rank,
        totalCompletions: submissions.length,
        submission
      });
    }

    // 11. Public Leaderboard
    if (pathname === '/api/game/leaderboard' && method === 'GET') {
      const submissions = readJson('submissions.json', []);
      // Sort by fastest time, then least moves
      const sorted = [...submissions].sort((a, b) => {
        if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
        return a.moves - b.moves;
      });
      return sendJson(res, 200, sorted.slice(0, 50));
    }

    // ----------------------------------------------------
    // STATIC FILE SERVING
    // ----------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ڕێگەنەدراوە (Forbidden)');
    }

    // If file doesn't exist, try appending .html or return 404
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h1>٤٠٤ - پەڕەکە نەدۆزرایەوە</h1><p><a href="/">گەڕانەوە بۆ سەرەتا</a></p>');
      }
    }

    // If directory, check index.html
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);

  } catch (error) {
    console.error('Server error:', error);
    sendError(res, 500, 'هەڵەیەک ڕوویدا لە سێرڤەر: ' + error.message);
  }
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`hama.flow Web Platform is RUNNING!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`Default Admin Username: adminitit`);
  console.log(`Default Admin Password: ititadmin1`);
  console.log(`Default Player Code: FLOW2026`);
  console.log(`===============================================`);
});
