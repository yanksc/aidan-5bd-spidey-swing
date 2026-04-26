'use strict';

// ============================================================
//  PHYSICS — player state, web mechanics, input, physics update
// ============================================================
(function () {
  const player = G.player;
  const game   = G.game;
  const MODE   = G.MODE;
  const STATE  = G.STATE;
  const audio  = G.audio;

  // ---- Player reset ----
  G.resetPlayer = function () {
    player.mode     = MODE.RUN;
    player.x        = G.playerScreenX();
    player.y        = G.groundY();
    player.vx       = 0;
    player.vy       = 0;
    player.angle    = 0;
    player.angVel   = 0;
    player.webGlow  = 0;
    player.squash   = 0;
    player.runPhase = 0;
    player.trail.length = 0;
    G.pressing = false;
  };

  // ---- Web mechanics ----
  // The user's tap defines the DIRECTION of the rope from the player.
  // The rope length is fixed (so swings feel consistent), and we DERIVE
  // the anchor position so the player never teleports — the swing always
  // begins from exactly where Spider-Man is right now.
  G.shootWebAt = function (targetX, targetY) {
    // Vector from player toward tap point
    let dx = targetX - player.x;
    let dy = targetY - player.y;

    // Rope must point upward; if user taps at/below player, force it up
    if (dy > -40) dy = -40;

    const len = Math.hypot(dx, dy);
    if (len < 0.001) { dx = 0; dy = -1; }

    // Fixed rope length keeps physics predictable & swings consistent
    const L = 320;

    // Unit direction toward anchor
    const ux = dx / len;
    const uy = dy / len;

    // Anchor = player + L * direction (player stays put, anchor placed above)
    let ax = player.x + ux * L;
    let ay = player.y + uy * L;

    // Clamp anchor inside the play area; if clamped, recompute so the
    // player still anchors at distance L (we slide the anchor along the
    // y-axis only, which is what the eye expects from a "swing").
    const minAY = G.ceilingY() + 20;
    if (ay < minAY) ay = minAY;
    if (ax < 40)        ax = 40;
    if (ax > G.W - 40)  ax = G.W - 40;

    // Recompute rope length from the (possibly clamped) anchor — this keeps
    // the geometry consistent: player.x/y stay put, anchor is wherever it
    // landed, rope length = the actual distance between them.
    const realL = Math.hypot(player.x - ax, player.y - ay);

    player.anchorX = ax;
    player.anchorY = ay;
    player.ropeLen = Math.max(80, realL);
    // Angle is measured from straight-down through the anchor.
    // sin(angle) = (player.x - ax) / L,  cos(angle) = (player.y - ay) / L
    player.angle   = Math.atan2(player.x - ax, player.y - ay);
    player.angVel  = 3.4; // forward angular velocity — strong enough to climb the arc
    player.mode    = MODE.SWING;
    player.webGlow = 1;

    G.webDust(ax, ay);
    audio.swing();
  };

  G.releaseWeb = function () {
    // Save anchor so the fading web line draws from the correct point after release
    player.lastAnchorX = player.anchorX;
    player.lastAnchorY = player.anchorY;

    // Always launch forward + up; magnitude scales with swing speed.
    // Upward boost is generous so Spidey can clear high-floating awards
    // (balloons, mom/bro medallions) hanging near the ceiling.
    const speed   = Math.abs(player.angVel) * player.ropeLen;
    const forward = Math.max(280, Math.min(speed * 0.60, 560));
    const upward  = Math.max(420, Math.min(speed * 1.10, 720));
    player.vx     = forward;
    player.vy     = -upward;
    player.mode   = MODE.LAUNCH;
    player.webGlow = 0.9;
    audio.swing();
  };

  // ---- Input ----
  window.addEventListener('mousemove', e => {
    G.lastMouseX = e.clientX;
    G.lastMouseY = e.clientY;
  });

  function onDown(e) {
    if (e.target && e.target.closest && e.target.closest('.btn')) return;
    audio.ensure();
    if (G.state !== STATE.PLAYING) return;
    const t = (e.touches && e.touches[0]) || e;
    G.pressing   = true;
    G.pressStart = performance.now();
    G.pressX     = (t.clientX != null) ? t.clientX : G.lastMouseX;
    G.pressY     = (t.clientY != null) ? t.clientY : G.lastMouseY;

    if (player.mode === MODE.RUN) {
      // Ground tap: big hop. Player must tap again in the air to shoot a web.
      player.vy     = -880;
      player.mode   = MODE.JUMP;
      player.squash = 0.6;
      audio.swing();
    } else if (player.mode === MODE.JUMP || player.mode === MODE.LAUNCH || player.mode === MODE.SWING) {
      // Mid-air: shoot web to wherever the user pressed
      G.shootWebAt(G.pressX, G.pressY);
    }
  }

  function onUp(e) {
    if (!G.pressing) return;
    G.pressing = false;
    if (G.state !== STATE.PLAYING) return;
    if (player.mode === MODE.SWING) {
      G.releaseWeb();
    }
  }

  window.addEventListener('touchstart',  onDown, { passive: true });
  window.addEventListener('mousedown',   onDown);
  window.addEventListener('touchend',    onUp,   { passive: true });
  window.addEventListener('mouseup',     onUp);
  window.addEventListener('touchcancel', onUp,   { passive: true });

  const SWING_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'Up', 'w', 'W']);
  const START_KEYS = new Set(['Enter', 'NumpadEnter']);

  function isFormEl(el) {
    return el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  window.addEventListener('keydown', e => {
    if (SWING_KEYS.has(e.key)) {
      if (!isFormEl(document.activeElement)) e.preventDefault();
      if (e.repeat) return;
      if (G.state !== STATE.PLAYING) return;
      const kbX = player.x + 180;
      const kbY = Math.max(G.ceilingY() + 40, player.y - 240);
      onDown({ clientX: kbX, clientY: kbY });
    } else if (START_KEYS.has(e.key)) {
      if (isFormEl(document.activeElement)) return;
      e.preventDefault();
      if (G.state === STATE.IDLE || G.state === STATE.OVER) {
        audio.ensure();
        G.startGame();
      }
    }
  });

  window.addEventListener('keyup', e => {
    if (SWING_KEYS.has(e.key)) {
      if (!isFormEl(document.activeElement)) e.preventDefault();
      if (G.state !== STATE.PLAYING) return;
      onUp({});
    }
  });

  // ---- Physics update (called once per frame from game.js update()) ----
  G.updatePhysics = function (dt) {
    const gravity = 1500;

    if (player.mode === MODE.RUN) {
      player.runPhase += dt * (8 + game.speed * 0.012);
      player.vy  = 0;
      player.y   = G.groundY();
      // Squash decays while on ground (landing squash animation)
      player.squash = Math.max(0, player.squash - dt * 4);

    } else if (player.mode === MODE.JUMP || player.mode === MODE.LAUNCH) {
      // FIX: squash also decays during flight so takeoff squash doesn't persist
      player.squash = Math.max(0, player.squash - dt * 4);
      player.vy += gravity * dt;
      player.y  += player.vy * dt;
      if (player.y >= G.groundY()) {
        player.y    = G.groundY();
        player.vy   = 0;
        player.mode = MODE.RUN;
        player.squash = 1; // landing squash
        audio.land();
        G.burst(player.x, player.y + 18, 'rgba(255,255,255,0.7)', 6, 180);
      }

    } else if (player.mode === MODE.SWING) {
      const G_CONST = 1500;
      const angAcc  = -(G_CONST / player.ropeLen) * Math.sin(player.angle);
      player.angVel += angAcc * dt;
      player.angVel *= Math.pow(0.985, dt * 60); // light damping
      player.angle  += player.angVel * dt;

      player.x = player.anchorX + Math.sin(player.angle) * player.ropeLen;
      player.y = player.anchorY + Math.cos(player.angle) * player.ropeLen;
      player.webGlow = 1;

      // Anchor scrolls left with the world
      player.anchorX -= game.speed * dt;

      // Allow the swing to carry farther up the arc before auto-release
      // so the player gains real altitude on each swing.
      const apex         = (player.angle > 0.95 && player.angVel < 1.2);
      const anchorBehind = (player.anchorX < player.x - 240);
      if (apex || anchorBehind) {
        G.releaseWeb();
      } else if (player.y >= G.groundY() - 4) {
        G.releaseWeb();
        player.vy = Math.min(player.vy, -260);
        player.y  = G.groundY() - 8;
      }
    }

    // ---- Camera / horizontal position ----
    const targetX = G.playerScreenX();
    if (player.mode === MODE.RUN) {
      player.x += (targetX - player.x) * Math.min(1, dt * 8);
    } else if (player.mode === MODE.JUMP || player.mode === MODE.LAUNCH) {
      player.x += player.vx * dt * 0.5;
      player.vx *= Math.pow(0.94, dt * 60);
      player.x += (targetX - player.x) * Math.min(1, dt * 1.5);
      player.x = Math.max(40, Math.min(G.W - 40, player.x));
    } else if (player.mode === MODE.SWING) {
      player.x = Math.max(40, Math.min(G.W - 40, player.x));
    }

    // ---- Trail ----
    if (player.mode !== MODE.RUN) {
      player.trail.push({ x: player.x, y: player.y - 4, age: 0 });
    }
    for (const t of player.trail) t.age += dt;
    while (player.trail.length && player.trail[0].age > 0.35) player.trail.shift();
    if (player.trail.length > 26) player.trail.splice(0, player.trail.length - 26);

    // ---- Timers ----
    if (player.webGlow > 0) player.webGlow = Math.max(0, player.webGlow - dt * 2);
    if (game.shake  > 0)    game.shake     = Math.max(0, game.shake  - dt * 60);
    if (game.flash  > 0)    game.flash     = Math.max(0, game.flash  - dt * 1.4);
    if (game.invuln > 0)    game.invuln    = Math.max(0, game.invuln - dt);
  };
})();
