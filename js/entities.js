'use strict';

// ============================================================
//  ENTITIES — collectibles + obstacles
// ============================================================
(function () {
  const entities = G.entities;
  const game     = G.game;
  const ctx      = G.ctx;

  G.TYPES = {
    SPIDER:  { emoji: '🕷️', points: 10, good: true,  size: 38, float: true  },
    BALLOON: { emoji: '🎈', points: 15, good: true,  size: 44, float: true  },
    GIFT:    { emoji: '🎁', points: 25, good: true,  size: 46, float: false },
    CAKE:    { emoji: '🎂', points: 50, good: true,  size: 52, float: false },
    STAR:    { emoji: '⭐', points: 35, good: true,  size: 40, float: true  },
    VILLAIN: { emoji: '😈', points: 0,  good: false, size: 52, float: false, ground: true },
    MONSTER: { emoji: '👹', points: 0,  good: false, size: 52, float: false, ground: true },
    GHOST:   { emoji: '👻', points: 0,  good: false, size: 50, float: true,  ground: false },
  };

  G.spawnInterval = function () {
    const t = Math.min(1, game.elapsed / 60);
    return 760 - t * 420; // 760ms → 340ms as time progresses
  };

  G.spawnEntity = function () {
    const TYPES = G.TYPES;
    const W = G.W;
    const r = Math.random();
    let key;
    if (r < 0.74) {
      const g = Math.random();
      key = g < 0.40 ? 'SPIDER' : g < 0.65 ? 'BALLOON' : g < 0.84 ? 'STAR' : g < 0.95 ? 'GIFT' : 'CAKE';
    } else {
      const b = Math.random();
      key = b < 0.45 ? 'VILLAIN' : b < 0.80 ? 'MONSTER' : 'GHOST';
    }
    const t = TYPES[key];
    let y;
    if (t.ground) {
      y = G.groundY() - t.size * 0.55;
    } else if (t.float) {
      y = G.ceilingY() + 80 + Math.random() * (G.groundY() - G.ceilingY() - 160);
    } else {
      y = G.groundY() - 30 - Math.random() * 60;
    }
    entities.push({
      type: key, x: W + t.size + 20, y, baseY: y,
      size: t.size, good: t.good, points: t.points,
      emoji: t.emoji,
      bob: Math.random() * Math.PI * 2,
      rot: 0, alive: true, glow: t.good ? 1 : 0.85,
    });
  };

  G.updateEntities = function (dt) {
    for (const e of entities) {
      if (!e.alive) continue;
      e.x -= game.speed * dt;
      e.bob += dt * 3;
      if (G.TYPES[e.type].float) e.y = e.baseY + Math.sin(e.bob) * 8;
      e.rot += dt * 0.6;
      if (e.x < -80) e.alive = false;
    }
    for (let i = entities.length - 1; i >= 0; i--) {
      if (!entities[i].alive) entities.splice(i, 1);
    }
  };

  G.checkCollisions = function () {
    const player = G.player;
    const px = player.x, py = player.y;
    const pr = 28;
    for (const e of entities) {
      if (!e.alive) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      const r = pr + e.size * 0.42;
      if (dx * dx + dy * dy < r * r) {
        if (e.good) {
          e.alive = false;
          game.combo += 1;
          game.comboTimer = 1.6;
          const mult  = Math.min(4, 1 + Math.floor((game.combo - 1) / 2) * 0.5);
          const gained = Math.round(e.points * mult);
          game.score += gained;
          G.burst(e.x, e.y, '#ffe066', 16, 320);
          G.popup(e.x, e.y - 10, '+' + gained + (mult > 1 ? ' ×' + mult : ''), '#ffe066');
          if (e.points >= 50) G.audio.big(); else G.audio.ding();
        } else {
          if (game.invuln > 0) continue;
          e.alive = false;
          game.lives -= 1;
          game.combo  = 0;
          game.shake  = 22;
          game.flash  = 0.6;
          game.invuln = 1.2;
          G.burst(e.x, e.y, '#ff4d4d', 18, 360);
          G.popup(e.x, e.y - 10, 'OUCH!', '#ff4d4d');
          G.audio.thud();
          if (game.lives <= 0) { setTimeout(G.endGame, 250); return; }
        }
      }
    }
  };

  G.drawEntities = function () {
    for (const e of entities) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.sin(e.bob) * 0.08);
      const haloColor = e.good ? 'rgba(255,230,102,0.85)' : 'rgba(255,80,80,0.85)';
      ctx.shadowColor = haloColor;
      ctx.shadowBlur  = e.good ? 22 : 14;
      ctx.font = `${e.size}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.emoji, 0, 0);
      ctx.restore();
    }
  };
})();
