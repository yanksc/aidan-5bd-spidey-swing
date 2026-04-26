'use strict';

// ============================================================
//  GAME — state machine, update loop, UI, initialization
// ============================================================
(function () {
  const game     = G.game;
  const player   = G.player;
  const entities = G.entities;
  const particles = G.particles;
  const popups   = G.popups;
  const MODE     = G.MODE;
  const STATE    = G.STATE;
  const audio    = G.audio;

  // ---- DOM refs ----
  const startScreen   = document.getElementById('startScreen');
  const endScreen     = document.getElementById('endScreen');
  const hud           = document.getElementById('hud');
  const countdownEl   = document.getElementById('countdown');
  const countNum      = document.getElementById('countNum');
  const scoreVal      = document.getElementById('scoreVal');
  const timeVal       = document.getElementById('timeVal');
  const livesVal      = document.getElementById('livesVal');
  const chipScore     = document.getElementById('chipScore');
  const chipTime      = document.getElementById('chipTime');
  const chipLives     = document.getElementById('chipLives');
  const finalScore    = document.getElementById('finalScore');
  const endTitle      = document.getElementById('endTitle');
  const endHint       = document.getElementById('endHint');
  const medalEmoji    = document.getElementById('medalEmoji');
  const confettiLayer = document.getElementById('confettiLayer');

  // Build per-letter animated title
  document.querySelectorAll('h1.title .word').forEach((wordEl, wIdx) => {
    const text = wordEl.dataset.word || '';
    wordEl.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = ch;
      span.style.animationDelay = (0.1 + (wIdx * text.length + i) * 0.06) + 's';
      wordEl.appendChild(span);
    });
  });

  let lastScoreShown = 0;
  let lastLivesShown = 3;

  document.getElementById('startBtn').addEventListener('click',     () => { audio.ensure(); G.startGame(); });
  document.getElementById('playAgainBtn').addEventListener('click', () => { audio.ensure(); G.startGame(); });

  // ---- Game flow ----
  G.startGame = function () {
    game.score      = 0;
    game.combo      = 0;  game.comboTimer = 0;
    game.lives      = 3;
    game.timeLeft   = 60;
    game.elapsed    = 0;
    game.spawnTimer = 0;
    game.shake      = 0;  game.flash   = 0;  game.invuln = 0;
    game.worldX     = 0;
    game.speed      = 280;
    entities.length  = 0;
    particles.length = 0;
    popups.length    = 0;
    G.resetPlayer();
    G.buildWorld();

    lastScoreShown = -1;
    lastLivesShown = -1;
    chipScore.classList.remove('bump');
    chipTime.classList.remove('warn');
    chipLives.classList.remove('hurt');

    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    confettiLayer.innerHTML = '';
    hud.classList.remove('hidden');
    updateHud();

    G.state = STATE.COUNTDOWN;
    runCountdown();
  };

  function runCountdown() {
    countdownEl.classList.remove('hidden');
    countdownEl.classList.add('soft');
    const steps = ['Ready?', 'Set...', 'Go!'];
    let i = 0;
    function next() {
      countNum.textContent = steps[i];
      countNum.classList.toggle('go', i === steps.length - 1);
      countNum.classList.remove('pop');
      void countNum.offsetWidth;
      countNum.classList.add('pop');
      if (i === steps.length - 1) audio.ding(); else audio.swing();
      i++;
      if (i < steps.length) {
        setTimeout(next, 480);
      } else {
        setTimeout(() => {
          countdownEl.classList.add('hidden');
          countdownEl.classList.remove('soft');
          G.state = STATE.PLAYING;
        }, 380);
      }
    }
    next();
  }

  G.endGame = function () {
    G.state = STATE.OVER;
    hud.classList.add('hidden');

    let title, medal;
    if      (game.score >= 700) { title = 'SPIDEY LEGEND!';   medal = '🏆'; }
    else if (game.score >= 450) { title = 'AMAZING SWINGER!'; medal = '🥇'; }
    else if (game.score >= 250) { title = 'NICE MOVES!';      medal = '🥈'; }
    else if (game.score > 0)    { title = 'GREAT TRY!';       medal = '🎖️'; }
    else                        { title = 'KEEP SWINGING!';   medal = '🕸️'; }

    endTitle.textContent  = title;
    medalEmoji.textContent = medal;
    endHint.innerHTML =
      '<span class="touch-hint">PASS THE PHONE — WHO\'S NEXT? 🎂</span>' +
      '<span class="kb-hint">PRESS <kbd>ENTER</kbd> TO PLAY AGAIN 🎂</span>';

    const medalEl = endScreen.querySelector('.medal');
    if (medalEl) { medalEl.style.animation = 'none'; void medalEl.offsetWidth; medalEl.style.animation = ''; }

    finalScore.textContent = '0';
    endScreen.classList.remove('hidden');
    spawnConfetti();
    audio.win();
    setTimeout(() => tweenNumber(finalScore, 0, game.score, 1100), 400);
  };

  function spawnConfetti() {
    confettiLayer.innerHTML = '';
    const colors = ['#ff2a4a', '#ffd400', '#00e5ff', '#ff5fa8', '#fff6e0', '#ffec4a'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement('i');
      piece.style.left              = (Math.random() * 100) + '%';
      piece.style.background        = colors[i % colors.length];
      piece.style.animationDuration = (1.8 + Math.random() * 2.4) + 's';
      piece.style.animationDelay    = (Math.random() * 0.6) + 's';
      piece.style.transform         = `rotate(${Math.random() * 360}deg)`;
      piece.style.width             = (6 + Math.random() * 8) + 'px';
      piece.style.height            = (10 + Math.random() * 14) + 'px';
      frag.appendChild(piece);
    }
    confettiLayer.appendChild(frag);
  }

  function tweenNumber(el, from, to, dur) {
    const start = performance.now();
    function step(now) {
      const t     = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateHud() {
    if (game.score !== lastScoreShown) {
      scoreVal.textContent = game.score;
      if (game.score > lastScoreShown) {
        chipScore.classList.remove('bump'); void chipScore.offsetWidth; chipScore.classList.add('bump');
      }
      lastScoreShown = game.score;
    }
    timeVal.textContent = Math.ceil(game.timeLeft);
    if (G.state === STATE.PLAYING && game.timeLeft <= 10 && game.timeLeft > 0) {
      chipTime.classList.add('warn');
    } else {
      chipTime.classList.remove('warn');
    }
    if (game.lives !== lastLivesShown) {
      livesVal.textContent = '❤️'.repeat(Math.max(0, game.lives)) + '🤍'.repeat(Math.max(0, 3 - game.lives));
      if (game.lives < lastLivesShown) {
        chipLives.classList.remove('hurt'); void chipLives.offsetWidth; chipLives.classList.add('hurt');
      }
      lastLivesShown = game.lives;
    }
  }

  // ---- Update loop ----
  function update(dt) {
    if (G.state !== STATE.PLAYING) {
      game.worldX += dt * 60; // gentle idle scroll on menus
      G.updateParticles(dt);
      return;
    }

    game.elapsed   += dt;
    game.timeLeft  -= dt;
    game.speed      = 280 + Math.min(220, game.elapsed * 5);
    game.worldX    += game.speed * dt;

    if (game.timeLeft <= 0) { game.timeLeft = 0; updateHud(); G.endGame(); return; }

    if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 0; }

    game.spawnTimer -= dt * 1000;
    if (game.spawnTimer <= 0) { G.spawnEntity(); game.spawnTimer = G.spawnInterval(); }

    G.updateEntities(dt);
    G.updatePhysics(dt);
    G.checkCollisions();
    G.updateParticles(dt);
    G.updatePopups(dt);
    updateHud();
  }

  // ---- Main loop ----
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    if (dt > 0.05) dt = 0.05;
    last = now;
    update(dt);
    G.render();
    requestAnimationFrame(loop);
  }

  // ---- Init ----
  G.resetPlayer();
  G.buildWorld();

  window.addEventListener('resize', () => {
    G.resetPlayer();
    G.buildWorld();
  });

  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick',     e => e.preventDefault());

  requestAnimationFrame(loop);
})();
