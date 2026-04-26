'use strict';

// ============================================================
//  WORLD — geometry helpers, layer generation, background draw
// ============================================================
(function () {
  const layers = G.layers;
  const ctx    = G.ctx;

  // ---- Geometry helpers (use G.W/G.H since they change on resize) ----
  G.groundY       = () => G.H * 0.74;
  G.ceilingY      = () => G.H * 0.06;
  G.playerScreenX = () => Math.min(G.W * 0.22, 220);

  // ---- Seeded RNG ----
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  }

  // ---- Build / rebuild all parallax layers ----
  G.buildWorld = function () {
    const r = rng(7);
    const W = G.W, H = G.H;

    layers.clouds = [];
    for (let i = 0; i < 14; i++) {
      layers.clouds.push({
        x: r() * W * 2, y: 30 + r() * (H * 0.18),
        w: 80 + r() * 140, h: 22 + r() * 18, o: 0.55 + r() * 0.35,
      });
    }

    layers.farSky = [];
    for (let i = 0; i < 26; i++) {
      const w = 70 + r() * 130;
      layers.farSky.push({
        x: r() * W * 3, w, h: 80 + r() * 160,
        roof: r() < 0.4 ? 'flat' : (r() < 0.7 ? 'pitch' : 'antenna'),
      });
    }

    layers.midCity = [];
    for (let i = 0; i < 22; i++) {
      const w = 90 + r() * 160;
      layers.midCity.push({
        x: r() * W * 3, w, h: 120 + r() * 220,
        windows: 0.55 + r() * 0.4,
        seed: Math.floor(r() * 1e6),
        cap: r() < 0.5 ? 'flat' : (r() < 0.8 ? 'water' : 'antenna'),
      });
    }

    // Continuous foreground rooftop strip — no gaps so it reads as solid ground
    layers.nearRoofs = [];
    let fx = 0;
    const span = W * 4;
    while (fx < span) {
      const segW = 140 + r() * 240;
      layers.nearRoofs.push({ x: fx, w: segW, h: 60 + r() * 30, type: r() < 0.7 ? 'normal' : 'tall' });
      fx += segW; // no 20px gap — contiguous rooftop
    }

    layers.silhouettes = [];
    for (let i = 0; i < 12; i++) {
      layers.silhouettes.push({
        x: r() * W * 2, y: H * 0.92 + r() * 18,
        w: 30 + r() * 80, h: 16 + r() * 18,
      });
    }

    layers.birds = [];
    for (let i = 0; i < 5; i++) {
      layers.birds.push({
        x: r() * W * 2, y: 60 + r() * (H * 0.18),
        size: 6 + r() * 4, phase: r() * Math.PI * 2,
      });
    }
  };

  // ---- Birthday-photo background -------------------------------
  // Two photo "slides" (knee + birthday) rotate as the gameplay scrolls.
  // Each slide is repeated a few times before the next slide takes over,
  // then we cross-fade between them at the seam so the transition is
  // never a hard cut. Since the same vertical band of width `dw` is
  // re-drawn each frame, we treat the world as an endless ribbon of
  // alternating slides at a fixed slot pitch.
  function makeBg(src) {
    const im = new Image();
    im.src = src;
    return im;
  }
  G.bgSlides = [
    { img: makeBg('assets/knee-bg.jpg'),     tint: 'rgba(246, 200, 76, 0.04)' },
    { img: makeBg('assets/birthday-bg.jpg'), tint: 'rgba(246, 63, 90, 0.04)'  },
  ];

  // How many slot widths each slide occupies before swapping to the next.
  // 2 keeps the rotation lively; bump higher if you want each photo to
  // linger longer.
  const SLOTS_PER_SLIDE = 2;

  G.drawBirthdayBg = function () {
    const game = G.game;
    const W = G.W, H = G.H;
    const groundY = G.groundY();

    // Cream wash behind in case the image hasn't decoded yet
    ctx.fillStyle = '#fdf3df';
    ctx.fillRect(0, 0, W, H);

    // Pick a reference slide for slot sizing; both photos share the same
    // aspect ratio (3648×5472 source) so any decoded image gives us `dw`.
    const ready = G.bgSlides.find(s => s.img.complete && s.img.naturalWidth);
    if (!ready) return;

    const dh = groundY;
    const dw = dh * (ready.img.naturalWidth / ready.img.naturalHeight);

    // Continuous scroll position, in slide-slots
    const scrollPx = game.worldX * 0.18;
    const startSlot = Math.floor(scrollPx / dw) - 1;
    const endSlot   = Math.ceil((scrollPx + W) / dw) + 1;

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const cycleIdx = Math.floor(slot / SLOTS_PER_SLIDE);
      const slide    = G.bgSlides[((cycleIdx % G.bgSlides.length) + G.bgSlides.length) % G.bgSlides.length];
      if (!slide.img.complete || !slide.img.naturalWidth) continue;
      const x = slot * dw - scrollPx;
      ctx.drawImage(slide.img, x, 0, dw, dh);
      // Per-slide warm tint (tiny — keeps both photos in the letterpress palette)
      ctx.fillStyle = slide.tint;
      ctx.fillRect(x, 0, dw, dh);
    }

    // Top fade for HUD legibility
    const topFade = ctx.createLinearGradient(0, 0, 0, H * 0.18);
    topFade.addColorStop(0, 'rgba(253,243,223,0.55)');
    topFade.addColorStop(1, 'rgba(253,243,223,0.0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, W, H * 0.18);

    // Bottom seam shadow into the ground strip
    const seam = ctx.createLinearGradient(0, groundY - 24, 0, groundY + 4);
    seam.addColorStop(0, 'rgba(26,10,46,0)');
    seam.addColorStop(1, 'rgba(26,10,46,0.45)');
    ctx.fillStyle = seam;
    ctx.fillRect(0, groundY - 24, W, 28);
  };

  // ---- Background draw functions (back → front) ----

  G.drawSkyAndSun = function () {
    const game = G.game;
    const W = G.W, H = G.H;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,    '#ffb3d4');
    g.addColorStop(0.35, '#ffc97a');
    g.addColorStop(0.65, '#ffe27a');
    g.addColorStop(1,    '#fff1a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sx = W * 0.78 - (game.worldX * 0.005) % W;
    const sy = H * 0.18;
    const sr = Math.min(W, H) * 0.10;

    const halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.6);
    halo.addColorStop(0, 'rgba(255,250,200,0.7)');
    halo.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 2.6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fff5b1';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((game.worldX * 0.0008) % (Math.PI * 2));
    ctx.strokeStyle = 'rgba(255,250,200,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(sr * 1.15, 0);
      ctx.lineTo(sr * 1.6, 0);
      ctx.stroke();
      ctx.rotate(Math.PI * 2 / 12);
    }
    ctx.restore();
  };

  G.drawClouds = function () {
    const game = G.game;
    const W = G.W;
    for (const c of layers.clouds) {
      const x  = ((c.x - game.worldX * 0.06) % (W * 2));
      const xr = x < -c.w ? x + W * 2 : (x > W + c.w ? x - W * 2 : x);
      ctx.save();
      ctx.globalAlpha = c.o;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(xr,             c.y,     c.w * 0.55, c.h,        0, 0, Math.PI * 2);
      ctx.ellipse(xr + c.w * 0.35, c.y - 6, c.w * 0.4,  c.h * 0.85, 0, 0, Math.PI * 2);
      ctx.ellipse(xr - c.w * 0.35, c.y + 4, c.w * 0.42, c.h * 0.8,  0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  G.drawBirds = function () {
    const game = G.game;
    const W = G.W;
    if (!layers.birds) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(40, 10, 70, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const b of layers.birds) {
      const x  = ((b.x - game.worldX * 0.10) % (W * 2));
      const xr = x < -20 ? x + W * 2 : (x > W + 20 ? x - W * 2 : x);
      const wing = Math.sin(game.elapsed * 4 + b.phase) * 3;
      ctx.beginPath();
      ctx.moveTo(xr - b.size, b.y + wing);
      ctx.lineTo(xr, b.y - 2);
      ctx.lineTo(xr + b.size, b.y + wing);
      ctx.stroke();
    }
    ctx.restore();
  };

  G.drawFarSky = function () {
    const game = G.game;
    const W = G.W, H = G.H;
    const baseY = H * 0.62;
    ctx.save();
    ctx.fillStyle = 'rgba(80, 30, 110, 0.45)';
    for (const b of layers.farSky) {
      const span = W * 3 + 600;
      const x  = ((b.x - game.worldX * 0.18) % span);
      const xr = x < -b.w ? x + span : x;
      ctx.fillRect(xr, baseY - b.h, b.w, b.h);
      if (b.roof === 'pitch') {
        ctx.beginPath();
        ctx.moveTo(xr,           baseY - b.h);
        ctx.lineTo(xr + b.w / 2, baseY - b.h - 18);
        ctx.lineTo(xr + b.w,     baseY - b.h);
        ctx.closePath(); ctx.fill();
      } else if (b.roof === 'antenna') {
        ctx.fillRect(xr + b.w * 0.55, baseY - b.h - 22, 3, 22);
      }
    }
    ctx.restore();
  };

  G.drawMidCity = function () {
    const game = G.game;
    const W = G.W, H = G.H;
    const baseY = H * 0.74;
    for (const b of layers.midCity) {
      const span = W * 3 + 800;
      const x  = ((b.x - game.worldX * 0.42) % span);
      const xr = x < -b.w ? x + span : x;

      const grad = ctx.createLinearGradient(xr, baseY - b.h, xr, baseY);
      grad.addColorStop(0, '#5a1e7a');
      grad.addColorStop(1, '#2c0a48');
      ctx.fillStyle = grad;
      ctx.fillRect(xr, baseY - b.h, b.w, b.h);

      ctx.fillStyle = 'rgba(255, 110, 170, 0.18)';
      ctx.fillRect(xr, baseY - b.h, 3, b.h);

      const cols  = Math.max(2, Math.floor(b.w / 18));
      const rows  = Math.max(3, Math.floor(b.h / 22));
      const cellW = b.w / cols;
      const cellH = b.h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = ((b.seed + r * 13 + c * 7) % 100) / 100;
          if (k < b.windows * 0.85) {
            const lit = (k * 173 % 1) > 0.45;
            ctx.fillStyle = lit ? 'rgba(255, 220, 120, 0.85)' : 'rgba(255, 220, 120, 0.18)';
            ctx.fillRect(xr + c * cellW + cellW * 0.25, baseY - b.h + r * cellH + cellH * 0.25,
                         cellW * 0.5, cellH * 0.5);
          }
        }
      }
      if (b.cap === 'water') {
        ctx.fillStyle = '#3a0e5e';
        ctx.fillRect(xr + b.w * 0.35, baseY - b.h - 10, b.w * 0.3, 10);
        ctx.fillRect(xr + b.w * 0.45, baseY - b.h - 22, b.w * 0.1, 14);
      } else if (b.cap === 'antenna') {
        ctx.fillStyle = '#3a0e5e';
        ctx.fillRect(xr + b.w * 0.5 - 1.5, baseY - b.h - 28, 3, 28);
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath(); ctx.arc(xr + b.w * 0.5, baseY - b.h - 28, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  // FIX: solid base fills the full width so no sky gaps appear between buildings.
  // FIX: segments now have no gap (buildWorld no longer adds the 20px gap).
  G.drawNearRoofs = function () {
    const game = G.game;
    const W = G.W, H = G.H;
    const baseY = G.groundY();
    const span  = W * 4;

    // Solid ground base — covers full bottom so gaps between buildings stay dark
    ctx.fillStyle = '#100228';
    ctx.fillRect(0, baseY, W, H - baseY);

    let acc = -((game.worldX * 0.78) % span);
    if (acc > 0) acc -= span;

    for (const seg of layers.nearRoofs) {
      const x = acc + seg.x;
      if (x + seg.w < -4 || x > W + 4) continue;

      // Building face
      ctx.fillStyle = '#1a0633';
      ctx.fillRect(x, baseY, seg.w, H - baseY);

      // Rooftop ledge — slightly lighter, gives the "edge you're standing on" feel
      ctx.fillStyle = '#2e1060';
      ctx.fillRect(x, baseY - 10, seg.w, 10);

      // Rim highlight: a bright 2px line marks the ground horizon clearly
      ctx.fillStyle = 'rgba(255, 100, 180, 0.55)';
      ctx.fillRect(x, baseY - 11, seg.w, 2);

      // Subtle brick texture on the facade
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let bx = x + 6; bx < x + seg.w - 6; bx += 16) {
        ctx.fillRect(bx,     baseY + 12, 10, 4);
        ctx.fillRect(bx + 8, baseY + 22, 10, 4);
      }

      // Soft shadow at building edges (subtle divider between segments)
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x + seg.w - 2, baseY - 10, 2, H - baseY + 10);
    }

    // Ground-level shadow gradient reinforces the horizon line
    const sg = ctx.createLinearGradient(0, baseY - 18, 0, baseY + 42);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, baseY - 18, W, 60);
  };

  G.drawSilhouettes = function () {
    const game = G.game;
    const W = G.W;
    for (const s of layers.silhouettes) {
      const x  = ((s.x - game.worldX * 1.15) % (W * 2));
      const xr = x < -s.w ? x + W * 2 : (x > W + s.w ? x - W * 2 : x);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(xr, s.y, s.w * 0.5, s.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
})();
