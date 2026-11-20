(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Config
   * ------------------------------------------------------------------ */
  const WORDS = `array async await bash bit blob bool branch buffer bug build byte cache callback class clone closure
cloud code commit component const context cookie crash css debug deploy dev docker dom domain editor element enum error
event export fetch fiber filter flex float font fork frame function git grid hash header heap hook hover html http import
index input json kernel key lambda layout lint loop macro map merge method mock module node null object offset parse patch
pixel pipe plugin pointer pop promise proxy pull push query queue react recursion redux regex render repo request return
route runtime scope script server session shell socket stack state static stream string style switch syntax tab tag token
tree tuple type typescript unix update vector view viewport vite web webpack widget worker yaml zip algorithm animation
backend binary bootstrap browser compile compiler database decorator dependency developer endpoint framework frontend
gateway generator hydration iterator javascript keyboard library middleware namespace package parameter pipeline polyfill
prototype repository responsive semantic sandbox terminal template transpile variable websocket`
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const MONO = 'ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace';
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  const MODES = {
    survival: { label: 'Survival', lives: 3, time: null },
    sprint: { label: 'Time Attack', lives: null, time: 60 },
  };

  const RANKS = [
    { min: 0, title: 'Script Kiddie', emoji: '🐣' },
    { min: 20, title: 'Junior Dev', emoji: '⌨️' },
    { min: 40, title: 'Mid-Level', emoji: '🚀' },
    { min: 60, title: 'Senior Dev', emoji: '⚡' },
    { min: 80, title: '10x Dev', emoji: '🔥' },
    { min: 100, title: 'Keyboard Wizard', emoji: '🧙' },
  ];

  /* ------------------------------------------------------------------ *
   *  Helpers
   * ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);

  const els = {
    screens: { menu: $('menu'), game: $('game'), result: $('result') },
    name: $('playerName'),
    sound: $('soundBtn'),
    arena: $('arena'),
    overlay: $('overlay'),
    typer: $('typer'),
    quit: $('quitBtn'),
    hud: {
      score: $('hudScore'),
      wpm: $('hudWpm'),
      acc: $('hudAcc'),
      combo: $('hudCombo'),
      comboLabel: $('hudComboLabel'),
      level: $('hudLevel'),
      lives: $('hudLives'),
      livesLabel: $('hudLivesLabel'),
    },
    resTitle: $('resTitle'),
    resBadge: $('resBadge'),
    card: $('card'),
    btnDownload: $('btnDownload'),
    btnShare: $('btnShare'),
    btnCopy: $('btnCopy'),
    btnAgain: $('btnAgain'),
    btnMenu: $('btnMenu'),
  };

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, String(value));
      } catch (_) {
        /* storage unavailable, ignore */
      }
    },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);

  function setText(el, value) {
    const v = String(value);
    if (el._v !== v) {
      el.textContent = v;
      el._v = v;
    }
  }

  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  /* ------------------------------------------------------------------ *
   *  Sound (tiny WebAudio beeps, no assets)
   * ------------------------------------------------------------------ */
  let muted = store.get('tr_muted', '0') === '1';
  let audioCtx = null;

  function beep(freq, dur = 0.07, type = 'sine', vol = 0.05) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime;
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (_) {
      /* audio not available */
    }
  }

  function syncSoundButton() {
    els.sound.textContent = muted ? '🔇' : '🔊';
    els.sound.setAttribute('aria-pressed', String(!muted));
  }

  /* ------------------------------------------------------------------ *
   *  Game state
   * ------------------------------------------------------------------ */
  let state = null;
  let rafId = 0;
  let lastTs = 0;
  let arenaW = 0;
  let arenaH = 0;
  let lastResult = null;

  function measure() {
    arenaW = els.arena.clientWidth;
    arenaH = els.arena.clientHeight;
  }

  function showScreen(name) {
    Object.entries(els.screens).forEach(([key, node]) => {
      node.hidden = key !== name;
    });
    window.scrollTo(0, 0);
  }

  function refreshBest() {
    document.querySelectorAll('[data-best]').forEach((node) => {
      node.textContent = Number(store.get('tr_best_' + node.dataset.best, '0')).toLocaleString();
    });
  }

  const multiplier = (combo) => Math.min(1 + Math.floor(combo / 5) * 0.5, 5);
  const levelFor = (wordsTyped) => 1 + Math.floor(wordsTyped / 8);
  const accuracy = (s) => (s.typedChars ? Math.round((s.correctChars / s.typedChars) * 100) : 100);

  function currentWpm(s) {
    if (s.elapsed < 2) return 0;
    return Math.round((s.doneChars + s.buffer.length) / 5 / (s.elapsed / 60));
  }

  function rankFor(wpm) {
    let found = RANKS[0];
    for (const r of RANKS) if (wpm >= r.min) found = r;
    return found;
  }

  /* ------------------------------------------------------------------ *
   *  Overlay
   * ------------------------------------------------------------------ */
  function showOverlay(big, small = '') {
    els.overlay.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'big';
    b.textContent = big;
    els.overlay.appendChild(b);
    if (small) {
      const s = document.createElement('div');
      s.className = 'small';
      s.textContent = small;
      els.overlay.appendChild(s);
    }
    els.overlay.hidden = false;
  }

  function hideOverlay() {
    els.overlay.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   *  Words
   * ------------------------------------------------------------------ */
  function pickWord(s) {
    const minLen = Math.min(3 + Math.floor((s.level - 1) / 2), 7);
    const maxLen = Math.min(5 + s.level, 14);
    const onScreen = new Set(s.words.map((w) => w.text));
    let pool = WORDS.filter((w) => w.length >= minLen && w.length <= maxLen && !onScreen.has(w));
    if (!pool.length) pool = WORDS.filter((w) => !onScreen.has(w));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickX(s, width, height) {
    const maxX = Math.max(0, arenaW - width - 16);
    let x = 8;
    for (let i = 0; i < 8; i++) {
      x = 8 + Math.random() * maxX;
      const clash = s.words.some(
        (o) => o.y < height + 10 && x < o.x + o.width + 8 && x + width + 8 > o.x
      );
      if (!clash) break;
    }
    return x;
  }

  function spawnWord(s) {
    const text = pickWord(s);
    const el = document.createElement('div');
    el.className = 'word';
    const doneEl = document.createElement('span');
    doneEl.className = 'done';
    const restEl = document.createElement('span');
    restEl.className = 'rest';
    restEl.textContent = text;
    el.append(doneEl, restEl);
    el.style.visibility = 'hidden';
    els.arena.appendChild(el);

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const base = s.mode === 'sprint' ? 45 + s.level * 6 : 36 + s.level * 8;
    const w = {
      text,
      el,
      doneEl,
      restEl,
      width,
      height,
      x: pickX(s, width, height),
      y: -height,
      speed: base * rand(0.9, 1.15),
    };
    el.style.transform = `translate3d(${w.x}px, ${w.y}px, 0)`;
    el.style.visibility = '';
    s.words.push(w);
  }

  function spawnInterval(s) {
    const base =
      s.mode === 'sprint' ? Math.max(0.6, 1.6 - s.level * 0.08) : Math.max(0.65, 2.3 - s.level * 0.14);
    return base * rand(0.8, 1.2);
  }

  function removeWord(s, w) {
    w.el.remove();
    const i = s.words.indexOf(w);
    if (i !== -1) s.words.splice(i, 1);
  }

  function setProgress(s) {
    for (const w of s.words) {
      const active = s.target === w && s.buffer.length > 0;
      w.doneEl.textContent = active ? s.buffer : '';
      w.restEl.textContent = active ? w.text.slice(s.buffer.length) : w.text;
      w.el.classList.toggle('active', active);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Effects
   * ------------------------------------------------------------------ */
  function popText(text, x, y, extraClass = '') {
    const p = document.createElement('div');
    p.className = 'pop ' + extraClass;
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    els.arena.appendChild(p);
    setTimeout(() => p.remove(), 850);
  }

  function burst(x, y) {
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const angle = (Math.PI * 2 * i) / 10 + rand(-0.3, 0.3);
      const dist = rand(30, 70);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      els.arena.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Core actions
   * ------------------------------------------------------------------ */
  function retarget(s, v) {
    const matches = s.words.filter((w) => w.text.startsWith(v));
    if (!v || !matches.length) {
      s.buffer = '';
      s.target = null;
      els.typer.value = '';
      return;
    }
    if (!(s.target && s.target.text.startsWith(v))) {
      s.target = matches.reduce((a, b) => (b.y > a.y ? b : a)); // closest to the ground
    }
  }

  function hitWord(s, w) {
    s.combo += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    const mult = multiplier(s.combo);
    const gained = Math.round(w.text.length * 10 * mult);
    s.score += gained;
    s.wordsTyped += 1;
    s.doneChars += w.text.length + 1;

    const cx = w.x + w.width / 2;
    const cy = w.y + w.height / 2;
    burst(cx, cy);
    popText('+' + gained, w.x, w.y);
    removeWord(s, w);

    s.buffer = '';
    s.target = null;
    els.typer.value = '';
    setProgress(s);
    beep(520 + Math.min(s.combo, 20) * 25, 0.08, 'triangle', 0.05);

    const newLevel = levelFor(s.wordsTyped);
    if (newLevel > s.level) {
      s.level = newLevel;
      popText('LEVEL ' + newLevel, Math.max(8, arenaW / 2 - 60), 40, 'level');
      beep(880, 0.18, 'sawtooth', 0.04);
    }
  }

  function missWord(s, w) {
    const wasTarget = s.target === w;
    removeWord(s, w);
    s.missed += 1;
    s.combo = 0;
    retrigger(els.arena, 'hit');
    beep(120, 0.2, 'sawtooth', 0.06);

    if (wasTarget) {
      s.target = null;
      retarget(s, s.buffer);
      setProgress(s);
    }
    if (s.cfg.lives !== null) {
      s.lives -= 1;
      if (s.lives <= 0) finish(s);
    }
  }

  function onInput() {
    const s = state;
    if (!s || !s.running || !s.ready || s.paused) {
      els.typer.value = '';
      return;
    }
    const v = els.typer.value.toLowerCase().replace(/[^a-z]/g, '');
    const prev = s.buffer;

    if (v.length > prev.length) {
      const added = v.length - prev.length;
      s.typedChars += added;
      const matches = s.words.filter((w) => w.text.startsWith(v));

      if (!matches.length) {
        s.combo = 0;
        els.typer.value = prev;
        retrigger(els.typer, 'error');
        beep(150, 0.12, 'sawtooth', 0.04);
        updateHud(s);
        return;
      }

      s.correctChars += added;
      s.buffer = v;
      els.typer.value = v;

      const exact = matches.find((w) => w.text === v);
      if (exact) {
        hitWord(s, exact);
        updateHud(s);
        return;
      }
      retarget(s, v);
      beep(380 + v.length * 18, 0.03, 'square', 0.02);
    } else {
      s.buffer = v;
      els.typer.value = v;
      retarget(s, v);
    }
    setProgress(s);
    updateHud(s);
  }

  /* ------------------------------------------------------------------ *
   *  Loop
   * ------------------------------------------------------------------ */
  function updateHud(s) {
    setText(els.hud.score, s.score.toLocaleString());
    setText(els.hud.wpm, currentWpm(s));
    setText(els.hud.acc, accuracy(s) + '%');
    setText(els.hud.combo, s.combo >= 5 ? s.combo + ' 🔥' : s.combo);
    setText(els.hud.comboLabel, 'Combo ×' + multiplier(s.combo));
    setText(els.hud.level, s.level);
    if (s.cfg.lives !== null) {
      setText(els.hud.livesLabel, 'Lives');
      setText(els.hud.lives, '♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(s.cfg.lives - Math.max(0, s.lives)));
    } else {
      setText(els.hud.livesLabel, 'Time');
      setText(els.hud.lives, Math.max(0, Math.ceil(s.timeLeft)) + 's');
    }
  }

  function update(s, dt) {
    s.elapsed += dt;

    if (s.cfg.time !== null) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        updateHud(s);
        finish(s);
        return;
      }
    }

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      spawnWord(s);
      s.spawnTimer = spawnInterval(s);
    }

    for (const w of [...s.words]) {
      w.y += w.speed * dt;
      if (w.y + w.height >= arenaH - 4) {
        missWord(s, w);
        if (!s.running) return;
      } else {
        w.el.style.transform = `translate3d(${w.x}px, ${w.y}px, 0)`;
      }
    }
    updateHud(s);
  }

  function frame(ts) {
    const s = state;
    if (!s || !s.running) return;
    const dt = Math.min(Math.max(0, (ts - lastTs) / 1000), 0.05);
    lastTs = ts;
    if (!s.paused) update(s, dt);
    if (s.running) rafId = requestAnimationFrame(frame);
  }

  async function countdown(s) {
    for (const n of ['3', '2', '1', 'GO!']) {
      if (state !== s || !s.running) return;
      showOverlay(n, n === 'GO!' ? '' : 'Get ready');
      beep(n === 'GO!' ? 880 : 440, 0.1, 'triangle', 0.05);
      await sleep(650);
    }
    if (state !== s || !s.running) return;
    hideOverlay();
    s.ready = true;
    s.paused = false;
    els.typer.focus();
  }

  function startGame(mode) {
    const cfg = MODES[mode];
    const playerName = els.name.value.trim() || 'Player 1';
    store.set('tr_name', els.name.value.trim());

    cancelAnimationFrame(rafId);
    state = {
      mode,
      cfg,
      name: playerName,
      running: true,
      ready: false,
      paused: true,
      words: [],
      target: null,
      buffer: '',
      score: 0,
      combo: 0,
      maxCombo: 0,
      level: 1,
      lives: cfg.lives,
      timeLeft: cfg.time,
      typedChars: 0,
      correctChars: 0,
      doneChars: 0,
      wordsTyped: 0,
      missed: 0,
      elapsed: 0,
      spawnTimer: 0.3,
    };

    showScreen('game');
    els.arena.querySelectorAll('.word, .pop, .particle').forEach((n) => n.remove());
    els.typer.value = '';
    measure();
    updateHud(state);

    lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
    countdown(state);
  }

  function setPaused(paused) {
    const s = state;
    if (!s || !s.running || !s.ready) return;
    s.paused = paused;
    if (paused) {
      showOverlay('Paused', 'Press Esc or click to resume');
    } else {
      hideOverlay();
      els.typer.focus();
    }
  }

  function quitToMenu() {
    if (state) state.running = false;
    cancelAnimationFrame(rafId);
    state = null;
    refreshBest();
    showScreen('menu');
  }

  /* ------------------------------------------------------------------ *
   *  Finish + result card
   * ------------------------------------------------------------------ */
  function finish(s) {
    s.running = false;
    cancelAnimationFrame(rafId);

    const minutes = Math.max(s.elapsed, 1) / 60;
    const wpm = Math.round(s.doneChars / 5 / minutes);
    const acc = accuracy(s);
    const rank = s.wordsTyped < 3 ? RANKS[0] : rankFor(wpm);

    const bestKey = 'tr_best_' + s.mode;
    const prevBest = Number(store.get(bestKey, '0'));
    const isBest = s.score > prevBest;
    if (isBest) store.set(bestKey, s.score);

    lastResult = {
      name: s.name,
      mode: s.mode,
      modeLabel: s.cfg.label,
      wpm,
      score: s.score,
      acc,
      combo: s.maxCombo,
      words: s.wordsTyped,
      level: s.level,
      rank,
    };

    els.resTitle.textContent = `${rank.emoji} ${rank.title} · ${wpm} WPM`;
    els.resBadge.hidden = !(isBest && s.score > 0);
    showScreen('result');
    drawCard(lastResult);
    beep(660, 0.12, 'triangle', 0.05);
    setTimeout(() => beep(880, 0.2, 'triangle', 0.05), 130);
    refreshBest();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(ctx, x, y, radius, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function shareUrl() {
    return location.protocol.startsWith('http') ? location.href.split(/[?#]/)[0] : '';
  }

  function drawCard(r) {
    const c = els.card;
    const ctx = c.getContext('2d');
    const W = 1200;
    const H = 630;
    c.width = W;
    c.height = H;

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b1538');
    bg.addColorStop(1, '#050918');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, 1020, 90, 440, 'rgba(139, 92, 246, 0.38)');
    glow(ctx, 110, 570, 400, 'rgba(34, 211, 238, 0.24)');

    // Grid
    ctx.strokeStyle = 'rgba(120, 150, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Frame
    roundRect(ctx, 24, 24, W - 48, H - 48, 28);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Brand + mode
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `800 36px ${SANS}`;
    ctx.fillStyle = '#e6ecff';
    ctx.fillText('Type', 70, 100);
    const typeW = ctx.measureText('Type').width;
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('Rush', 70 + typeW, 100);

    ctx.textAlign = 'right';
    ctx.font = `600 26px ${MONO}`;
    ctx.fillStyle = '#8a97c4';
    ctx.fillText(r.modeLabel.toUpperCase(), W - 70, 100);

    // Player
    ctx.textAlign = 'left';
    ctx.font = `600 24px ${MONO}`;
    ctx.fillStyle = '#8a97c4';
    ctx.fillText('PLAYER', 70, 175);
    ctx.font = `700 46px ${SANS}`;
    ctx.fillStyle = '#e6ecff';
    ctx.fillText(r.name, 70, 230);

    // Big WPM
    const wg = ctx.createLinearGradient(70, 0, 560, 0);
    wg.addColorStop(0, '#22d3ee');
    wg.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = wg;
    ctx.font = `800 200px ${SANS}`;
    const wpmText = String(r.wpm);
    ctx.fillText(wpmText, 62, 420);
    const numW = ctx.measureText(wpmText).width;
    ctx.font = `700 44px ${MONO}`;
    ctx.fillStyle = '#8a97c4';
    ctx.fillText('WPM', 62 + numW + 20, 420);

    // Rank
    ctx.textAlign = 'right';
    ctx.font = `600 24px ${MONO}`;
    ctx.fillStyle = '#8a97c4';
    ctx.fillText('RANK', W - 70, 175);
    ctx.font = `110px ${SANS}`;
    ctx.fillStyle = '#e6ecff';
    ctx.fillText(r.rank.emoji, W - 70, 305);
    ctx.font = `800 44px ${SANS}`;
    ctx.fillText(r.rank.title, W - 70, 375);

    // Stats row
    ctx.textAlign = 'left';
    const stats = [
      ['SCORE', r.score.toLocaleString()],
      ['ACCURACY', r.acc + '%'],
      ['BEST COMBO', String(r.combo)],
      ['WORDS', String(r.words)],
    ];
    stats.forEach(([label, value], i) => {
      const x = 70 + i * 290;
      ctx.font = `600 20px ${MONO}`;
      ctx.fillStyle = '#8a97c4';
      ctx.fillText(label, x, 490);
      ctx.font = `700 46px ${MONO}`;
      ctx.fillStyle = '#e6ecff';
      ctx.fillText(value, x, 540);
    });

    // Footer
    ctx.font = `600 22px ${MONO}`;
    ctx.fillStyle = '#22d3ee';
    const url = shareUrl().replace(/^https?:\/\//, '');
    ctx.fillText(url ? 'Can you beat me? ' + url : 'Can you beat me?', 70, 588);
  }

  function shareText() {
    const r = lastResult;
    const url = shareUrl();
    return (
      `⌨️ I just hit ${r.wpm} WPM (${r.acc}% accuracy) on TypeRush ${r.modeLabel}: ` +
      `${r.rank.emoji} ${r.rank.title}, score ${r.score.toLocaleString()}. Can you beat me?` +
      (url ? ' ' + url : '')
    );
  }

  const cardBlob = () => new Promise((resolve) => els.card.toBlob(resolve, 'image/png'));

  function tempLabel(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = old), 1500);
  }

  async function downloadCard() {
    const blob = await cardBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'typerush-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText());
      tempLabel(els.btnCopy, '✓ Copied!');
    } catch (_) {
      window.prompt('Copy your result:', shareText());
    }
  }

  async function nativeShare() {
    const text = shareText();
    try {
      const blob = await cardBlob();
      const file = new File([blob], 'typerush-result.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        await navigator.share({ text });
      }
    } catch (_) {
      /* share cancelled */
    }
  }

  /* ------------------------------------------------------------------ *
   *  Wiring
   * ------------------------------------------------------------------ */
  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => startGame(btn.dataset.mode));
  });

  els.typer.addEventListener('input', onInput);
  els.arena.addEventListener('click', () => {
    if (state && state.paused && state.ready) setPaused(false);
    else els.typer.focus();
  });
  els.quit.addEventListener('click', quitToMenu);

  els.btnDownload.addEventListener('click', downloadCard);
  els.btnCopy.addEventListener('click', copyText);
  els.btnShare.addEventListener('click', nativeShare);
  els.btnAgain.addEventListener('click', () => lastResult && startGame(lastResult.mode));
  els.btnMenu.addEventListener('click', quitToMenu);
  if (navigator.share) els.btnShare.hidden = false;

  els.sound.addEventListener('click', () => {
    muted = !muted;
    store.set('tr_muted', muted ? '1' : '0');
    syncSoundButton();
    beep(660, 0.08);
  });

  document.addEventListener('keydown', (e) => {
    if (els.screens.game.hidden || !state || !state.running) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.ready) setPaused(!state.paused);
      return;
    }
    if (!state.paused && document.activeElement !== els.typer && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      els.typer.focus();
    }
  });

  window.addEventListener('blur', () => {
    if (state && state.running && state.ready && !state.paused) setPaused(true);
  });
  window.addEventListener('resize', measure);

  els.name.value = store.get('tr_name', '');
  syncSoundButton();
  refreshBest();
})();
