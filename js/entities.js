'use strict';

// ============================================================
//  ENTITIES — collectibles + obstacles
// ============================================================
(function () {
  const entities = G.entities;
  const game     = G.game;
  const ctx      = G.ctx;

  // Each entity type maps to a letterpress SVG symbol from the icon library
  // in index.html. Symbols rasterize into offscreen canvases at startup so
  // the per-frame draw is a single drawImage call.
  // Family-face awards: circle-cropped portraits replace the spider & gift
  // collectibles. Slightly bigger than the old icons so the faces read
  // clearly while flying past. `imgSrc` triggers the PNG loader path;
  // entries with `iconId` use the inline-SVG <symbol> rasterizer.
  G.TYPES = {
    MOM:     { imgSrc: 'assets/face-mom.png', points: 20, good: true,  size: 64, float: true  },
    DAD:     { imgSrc: 'assets/face-dad.png', points: 25, good: true,  size: 64, float: false },
    BRO:     { imgSrc: 'assets/face-bro.png', points: 35, good: true,  size: 60, float: true  },
    BALLOON: { iconId: 'icon-balloon',        points: 15, good: true,  size: 48, float: true  },
    CAKE:    { iconId: 'icon-cake',           points: 50, good: true,  size: 56, float: false },
    VILLAIN: { iconId: 'icon-villain',        points: 0,  good: false, size: 56, float: false, ground: true },
    MONSTER: { iconId: 'icon-monster',        points: 0,  good: false, size: 56, float: false, ground: true },
    GHOST:   { iconId: 'icon-ghost',          points: 0,  good: false, size: 54, float: true,  ground: false },
  };

  // Each type gets a stable bitmap key — an SVG-symbol id, or the photo path
  for (const k in G.TYPES) {
    const t = G.TYPES[k];
    t.bmpKey = t.imgSrc || t.iconId;
  }

  // ---- Rasterize SVG <symbol>s and load PNG portraits into offscreen
  //       canvases so the per-frame draw is a single drawImage call.
  G.iconBitmaps = Object.create(null);

  function rasterSvgSymbol(type) {
    const sym = document.getElementById(type.iconId);
    if (!sym) return;
    const vb = sym.getAttribute('viewBox') || '0 0 64 64';
    const inner = sym.innerHTML;
    const svgString =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = function () {
      const SIZE = 128;
      const bmp = document.createElement('canvas');
      bmp.width = SIZE; bmp.height = SIZE;
      bmp.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE);
      G.iconBitmaps[type.bmpKey] = bmp;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function loadPngPortrait(type) {
    const img = new Image();
    img.onload = function () {
      // Render at native size to preserve the carefully-baked ring/shadow
      const bmp = document.createElement('canvas');
      bmp.width  = img.naturalWidth;
      bmp.height = img.naturalHeight;
      bmp.getContext('2d').drawImage(img, 0, 0);
      G.iconBitmaps[type.bmpKey] = bmp;
    };
    img.onerror = function () {
      console.warn('[entities] portrait failed to load:', type.imgSrc);
    };
    img.src = type.imgSrc;
  }

  for (const k in G.TYPES) {
    const t = G.TYPES[k];
    if (t.imgSrc)      loadPngPortrait(t);
    else if (t.iconId) rasterSvgSymbol(t);
  }

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
      // Collectibles: family faces are the headline awards
      const g = Math.random();
      key = g < 0.28 ? 'MOM'
          : g < 0.52 ? 'DAD'
          : g < 0.72 ? 'BRO'
          : g < 0.90 ? 'BALLOON'
          :            'CAKE';
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
      bmpKey: t.bmpKey,
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

  // Draw a soft "letterpress halo" backing — a flat-colour disc sized to the
  // icon, no neon glow. Collectibles get a honey halo, baddies a coral one.
  function drawHalo(x, y, r, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  G.drawEntities = function () {
    for (const e of entities) {
      const bmp = G.iconBitmaps[e.bmpKey];
      if (!bmp) continue;            // not yet rasterized — skip this frame

      const tilt = Math.sin(e.bob) * 0.08;
      const half = e.size * 0.5;
      const isPortrait = !!G.TYPES[e.type].imgSrc;

      if (!isPortrait) {
        // Halo backing for SVG icons — portraits ship with their own ring + shadow
        const haloFill = e.good
          ? 'rgba(246, 200, 76, 0.32)'   // honey
          : 'rgba(246, 63, 90, 0.28)';   // coral
        drawHalo(e.x, e.y, half + 6, haloFill);
      } else {
        // Soft golden glow behind the family-face awards
        ctx.save();
        const gp = ctx.createRadialGradient(e.x, e.y, half * 0.4, e.x, e.y, half * 1.4);
        gp.addColorStop(0, 'rgba(246, 200, 76, 0.55)');
        gp.addColorStop(1, 'rgba(246, 200, 76, 0)');
        ctx.fillStyle = gp;
        ctx.beginPath(); ctx.arc(e.x, e.y, half * 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(tilt);
      ctx.drawImage(bmp, -half, -half, e.size, e.size);
      ctx.restore();
    }
  };
})();
