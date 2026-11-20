// Flow Free Game Engine
// Kurdish Localization & High Performance Canvas Renderer

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error", e);
    }
  }

  playDrag() {
    this.playTone(320, 'sine', 0.04, 0.03);
  }

  playConnect() {
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.12, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    } catch (e) {}
  }

  playCut() {
    this.playTone(180, 'triangle', 0.08, 0.08);
  }

  playWin() {
    if (!this.enabled) return;
    try {
      this.init();
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.18, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.4);
      });
    } catch (e) {}
  }
}

class ConfettiFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.animId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 90) {
    if (!this.ctx) return;
    this.resize();
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: this.canvas.height / 2 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 1.2) * 14,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }
    if (!this.animId) this.loop();
  }

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.009;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();

      if (p.alpha <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.loop());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

class FlowFreeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;
    this.sound = new SoundManager();

    this.level = null;
    this.size = 5;
    this.dots = []; // [{ color, name, p1: [r,c], p2: [r,c] }]
    this.dotLookup = {}; // "r,c" -> { color, isDot: true }
    this.paths = {}; // color -> Array of [r, c]
    this.history = []; // For undo support

    this.isDragging = false;
    this.currentColor = null;
    this.dragStartCell = null;
    this.hasWon = false;

    this.moves = 0;
    this.timeSeconds = 0;
    this.timerInterval = null;

    this.onWin = options.onWin || (() => {});
    this.onStatsChange = options.onStatsChange || (() => {});

    this.initEvents();
  }

  loadLevel(level) {
    this.level = level;
    this.size = level.size || 5;
    this.dots = level.dots || [];
    this.dotLookup = {};
    this.paths = {};
    this.history = [];
    this.hasWon = false;
    this.isDragging = false;
    this.currentColor = null;
    this.moves = 0;
    this.timeSeconds = 0;

    // Build dot lookup
    this.dots.forEach(d => {
      this.dotLookup[`${d.p1[0]},${d.p1[1]}`] = { color: d.color, pair: d.p2, isDot: true };
      this.dotLookup[`${d.p2[0]},${d.p2[1]}`] = { color: d.color, pair: d.p1, isDot: true };
      this.paths[d.color] = [];
    });

    this.resetTimer();
    this.startTimer();
    this.resizeCanvas();
    this.render();
    this.updateStats();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.cellSize = rect.width / this.size;
    this.render();
  }

  resetTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timeSeconds = 0;
  }

  startTimer() {
    this.resetTimer();
    this.timerInterval = setInterval(() => {
      if (!this.hasWon) {
        this.timeSeconds++;
        this.updateStats();
      }
    }, 1000);
  }

  getCellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
      return [r, c];
    }
    return null;
  }

  initEvents() {
    const handleStart = (e) => {
      if (this.hasWon) return;
      e.preventDefault();
      const cell = this.getCellFromEvent(e);
      if (!cell) return;
      this.sound.init();

      const [r, c] = cell;
      const key = `${r},${c}`;
      const dot = this.dotLookup[key];

      // Save state for undo
      this.saveHistory();

      if (dot) {
        this.isDragging = true;
        this.currentColor = dot.color;
        this.dragStartCell = cell;

        // If starting from a dot, start a new path from this dot
        this.paths[this.currentColor] = [cell];
        this.moves++;
        this.sound.playDrag();
        this.render();
        this.updateStats();
      } else {
        // Check if clicking on an existing path
        for (const [col, path] of Object.entries(this.paths)) {
          const idx = path.findIndex(p => p[0] === r && p[1] === c);
          if (idx !== -1) {
            this.isDragging = true;
            this.currentColor = col;
            this.dragStartCell = cell;
            // Trim path up to this cell
            this.paths[col] = path.slice(0, idx + 1);
            this.moves++;
            this.sound.playDrag();
            this.render();
            this.updateStats();
            break;
          }
        }
      }
    };

    const handleMove = (e) => {
      if (!this.isDragging || !this.currentColor || this.hasWon) return;
      e.preventDefault();
      const cell = this.getCellFromEvent(e);
      if (!cell) return;

      const [r, c] = cell;
      const path = this.paths[this.currentColor];
      if (!path || path.length === 0) return;

      const last = path[path.length - 1];
      if (last[0] === r && last[1] === c) return; // Same cell

      // Must be adjacent (orthogonal)
      const dist = Math.abs(last[0] - r) + Math.abs(last[1] - c);
      if (dist !== 1) return;

      // Undo one step if moving back to previous cell in current path
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        if (prev[0] === r && prev[1] === c) {
          path.pop();
          this.sound.playDrag();
          this.render();
          this.updateStats();
          return;
        }
      }

      // Check if entering a cell with another color's dot
      const dot = this.dotLookup[`${r},${c}`];
      if (dot && dot.color !== this.currentColor) {
        return; // Cannot pass through a different color's dot!
      }

      // If cell already has a path of another color, cut that path!
      for (const [col, otherPath] of Object.entries(this.paths)) {
        if (col !== this.currentColor) {
          const cutIdx = otherPath.findIndex(p => p[0] === r && p[1] === c);
          if (cutIdx !== -1) {
            this.paths[col] = otherPath.slice(0, cutIdx);
            this.sound.playCut();
            break;
          }
        }
      }

      // If cell is already in the current path earlier, trim the loop
      const loopIdx = path.findIndex(p => p[0] === r && p[1] === c);
      if (loopIdx !== -1) {
        this.paths[this.currentColor] = path.slice(0, loopIdx + 1);
        this.render();
        return;
      }

      // Add to current path
      path.push([r, c]);
      this.sound.playDrag();

      // Check if reached the target matching dot!
      if (dot && dot.color === this.currentColor && (dot.pair[0] === path[0][0] && dot.pair[1] === path[0][1])) {
        this.isDragging = false;
        this.sound.playConnect();
        this.render();
        this.checkWin();
        return;
      }

      this.render();
      this.updateStats();
    };

    const handleEnd = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        this.checkWin();
      }
    };

    this.canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    this.canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  saveHistory() {
    const clone = {};
    for (const [col, p] of Object.entries(this.paths)) {
      clone[col] = p.map(pt => [...pt]);
    }
    this.history.push({ paths: clone, moves: this.moves });
    if (this.history.length > 25) this.history.shift();
  }

  undo() {
    if (this.history.length === 0 || this.hasWon) return;
    const last = this.history.pop();
    this.paths = last.paths;
    this.moves++;
    this.render();
    this.updateStats();
  }

  resetLevel() {
    this.dots.forEach(d => {
      this.paths[d.color] = [];
    });
    this.moves = 0;
    this.timeSeconds = 0;
    this.hasWon = false;
    this.history = [];
    this.render();
    this.updateStats();
  }

  isFlowConnected(color) {
    const path = this.paths[color];
    if (!path || path.length < 2) return false;
    const start = path[0];
    const end = path[path.length - 1];
    const d1 = this.dotLookup[`${start[0]},${start[1]}`];
    const d2 = this.dotLookup[`${end[0]},${end[1]}`];
    return (d1 && d1.color === color && d2 && d2.color === color && (start[0] !== end[0] || start[1] !== end[1]));
  }

  getStats() {
    let connectedFlows = 0;
    this.dots.forEach(d => {
      if (this.isFlowConnected(d.color)) connectedFlows++;
    });

    // Count occupied cells
    const occupied = new Set();
    Object.values(this.paths).forEach(path => {
      path.forEach(([r, c]) => occupied.add(`${r},${c}`));
    });

    const totalCells = this.size * this.size;
    const coverage = Math.min(100, Math.round((occupied.size / totalCells) * 100));

    return {
      connected: connectedFlows,
      totalFlows: this.dots.length,
      coverage: coverage,
      moves: this.moves,
      timeSeconds: this.timeSeconds
    };
  }

  updateStats() {
    const stats = this.getStats();
    this.onStatsChange(stats);
  }

  checkWin() {
    const stats = this.getStats();
    const requireFull = this.options.requireFullBoard !== false;
    const allConnected = stats.connected === stats.totalFlows;
    const fullBoard = !requireFull || (stats.coverage === 100);

    if (allConnected && fullBoard && !this.hasWon) {
      this.hasWon = true;
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.sound.playWin();
      this.render();
      this.onWin({
        level: this.level,
        moves: this.moves,
        timeSeconds: this.timeSeconds,
        coverage: stats.coverage
      });
    }
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const cs = this.cellSize;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // 1. Grid Background & Grid Lines
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= this.size; i++) {
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(width, i * cs);
      ctx.stroke();

      // Vertical
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, height);
      ctx.stroke();
    }

    // 2. Draw Pipes (Paths)
    for (const [col, path] of Object.entries(this.paths)) {
      if (path.length < 1) continue;

      const isConnected = this.isFlowConnected(col);
      const pipeWidth = cs * 0.38;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pipe Outer Glow
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = isConnected ? 16 : 8;
      ctx.lineWidth = pipeWidth;

      ctx.beginPath();
      const startX = path[0][1] * cs + cs / 2;
      const startY = path[0][0] * cs + cs / 2;
      ctx.moveTo(startX, startY);

      for (let i = 1; i < path.length; i++) {
        const px = path[i][1] * cs + cs / 2;
        const py = path[i][0] * cs + cs / 2;
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Pipe Inner Highlight
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = pipeWidth * 0.3;
      ctx.stroke();

      ctx.restore();
    }

    // 3. Draw Dots (Nodes)
    this.dots.forEach(d => {
      [d.p1, d.p2].forEach(([r, c]) => {
        const cx = c * cs + cs / 2;
        const cy = r * cs + cs / 2;
        const dotRadius = cs * 0.34;
        const isConnected = this.isFlowConnected(d.color);

        ctx.save();
        // Dot Outer Glow
        ctx.shadowColor = d.color;
        ctx.shadowBlur = isConnected ? 22 : 12;

        // Base circle
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // If connected, draw a neat check or subtle ring
        if (isConnected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      });
    });
  }
}

window.FlowFreeGame = FlowFreeGame;
window.ConfettiFX = ConfettiFX;
