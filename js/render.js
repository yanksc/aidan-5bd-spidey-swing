'use strict';

// ============================================================
//  RENDER — all canvas drawing, sprite-based player character
// ============================================================
(function () {
  const player = G.player;
  const game   = G.game;
  const ctx    = G.ctx;
  const MODE   = G.MODE;

  // ============================================================
  //  SPRITE SHEET — load + chroma-key the green screen background
  //
  //  Layout: 4 columns × 2 rows = 8 frames (312 × 416 px each)
  //   Columns 1-2 → RUN frames  (indices 0, 1, 4, 5)
  //   Column  3   → JUMP frame  (indices 2, 6)
  //   Column  4   → SWING frame (indices 3, 7)
  // ============================================================
  const SHEET_COLS = 4;
  const SHEET_ROWS = 2;
  const SRC_W = 1248;   // full sprite sheet width
  const SRC_H = 832;    // full sprite sheet height
  const FRAME_W = SRC_W / SHEET_COLS;  // 312
  const FRAME_H = SRC_H / SHEET_ROWS;  // 416

  // Where the character's FEET are within a frame (as a fraction of FRAME_H).
  const FEET_FRAC = 0.92;

  // Render height of the sprite on screen (tweak to taste)
  const DRAW_H = 110;
  const DRAW_W = DRAW_H * (FRAME_W / FRAME_H); // keeps aspect ratio ≈ 82px

  G.spriteReady  = false;
  G.spriteCanvas = document.createElement('canvas');
  G.spriteCanvas.width  = SRC_W;
  G.spriteCanvas.height = SRC_H;

  // Always render the real PNG sprite from assets/. No vector fallback.
  // If chroma-key can't run (file:// taints the canvas), we render the raw
  // image — green background and all — which keeps the photographed
  // character on screen exactly as authored.
  G.spriteChromaKeyed = false;

  function loadSpriteFrom(srcPath, useCors) {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';

    img.onload = function () {
      const sc = G.spriteCanvas.getContext('2d');
      sc.clearRect(0, 0, SRC_W, SRC_H);
      sc.drawImage(img, 0, 0, SRC_W, SRC_H);

      // Best-effort chroma-key. If getImageData throws (file:// taint),
      // we keep the image as-drawn. The player still appears.
      try {
        const imgData = sc.getImageData(0, 0, SRC_W, SRC_H);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (g > r * 1.25 && g > b * 1.25 && g > 60) {
            const greenness = Math.min(
              (g / (r + 1) - 1.25) / 0.75,
              (g / (b + 1) - 1.25) / 0.75
            );
            const alpha = Math.max(0, 1 - greenness);
            d[i + 3] = Math.round(alpha * alpha * 255);
          }
        }
        sc.putImageData(imgData, 0, 0);
        G.spriteChromaKeyed = true;
      } catch (err) {
        console.warn('[spidey] chroma-key skipped (' + err.message + ') — rendering raw sprite');
        // The earlier drawImage already painted the raw frame, nothing to redo.
      }

      G.spriteReady = true;
      console.log('[spidey] sprite loaded from', srcPath, '— chromaKeyed=' + G.spriteChromaKeyed);
    };

    img.onerror = function () {
      console.warn('[spidey] failed to load', srcPath);
      // Try the .jpg variant if the .png path failed
      if (srcPath.endsWith('.png')) {
        loadSpriteFrom('assets/spidey-sprite.jpg', useCors);
      } else if (useCors) {
        // Try once more without CORS — file:// + crossOrigin can fail
        loadSpriteFrom('assets/spidey-sprite.png', false);
      } else {
        console.error('[spidey] all sprite paths failed');
      }
    };

    img.src = srcPath;
  }

  // Use anonymous CORS only over HTTP(S); on file:// it just causes failures.
  const useCors = (location.protocol === 'http:' || location.protocol === 'https:');
  loadSpriteFrom('assets/spidey-sprite.png', useCors);

  // ---- Frame → sheet coordinates ----
  function frameRect(idx) {
    const col = idx % SHEET_COLS;
    const row = Math.floor(idx / SHEET_COLS);
    return { sx: col * FRAME_W, sy: row * FRAME_H };
  }

  // ---- Pick the right frame for current player state ----
  //
  //  Sheet layout (col indices 0-3, row indices 0-1):
  //    Col 0 = run-A  (frame  0)   Col 1 = run-B  (frame  1)
  //    Col 2 = jump   (frame  2)   Col 3 = swing  (frame  3)
  //    Col 0 = run-C  (frame  4)   Col 1 = run-D  (frame  5)
  //    Col 2 = jump   (frame  6)   Col 3 = swing  (frame  7)
  //
  function currentFrame() {
    switch (player.mode) {
      case MODE.RUN: {
        // 4-frame run cycle using the two RUN columns across both rows: 0→1→4→5
        const RUN_SEQ = [0, 1, 4, 5];
        const idx = Math.floor(player.runPhase * 0.7) % 4;
        return RUN_SEQ[((idx % 4) + 4) % 4];
      }
      case MODE.SWING:
        // Alternate between the two swing frames for a subtle animation
        return (Math.floor(Date.now() / 180) % 2 === 0) ? 3 : 7;
      case MODE.JUMP:
      case MODE.LAUNCH:
      default:
        // Alternate between the two jump frames for a subtle animation
        return (Math.floor(Date.now() / 150) % 2 === 0) ? 2 : 6;
    }
  }

  // ============================================================
  //  Draw player using the sprite sheet
  // ============================================================
  G.drawSpiderMan = function () {
    if (!G.spriteReady) return; // still loading — skip until ready

    const x = player.x;
    const y = player.y;

    const blink = game.invuln > 0 && (Math.floor(game.invuln * 14) % 2 === 0);

    ctx.save();

    // ---- Ground / air shadow ----
    if (player.mode === MODE.RUN) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const dist = Math.max(0, G.groundY() - y);
      const alpha = Math.max(0.05, 0.35 - dist * 0.0014);
      const scaleX = Math.max(0.4, 1 - dist * 0.002);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, G.groundY() + 5, 24 * scaleX, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Position: sprite feet sit on player.y ----
    const drawX = x - DRAW_W / 2;
    const drawY = y - DRAW_H * FEET_FRAC;

    // ---- Rotation for swing / flight ----
    let tilt = 0;
    if (player.mode === MODE.SWING) {
      // Gently rotate with the pendulum — keeps the hat roughly upright
      tilt = player.angle * 0.45;
    } else if (player.mode === MODE.JUMP || player.mode === MODE.LAUNCH) {
      // Slight forward lean when rising, slight back lean when falling
      tilt = Math.max(-0.18, Math.min(0.22, player.vy * -0.00018));
    }

    // Rotate around the character's visual centre (midpoint of body, not hat)
    const pivotX = x;
    const pivotY = y - DRAW_H * 0.30; // roughly where body centre is

    ctx.translate(pivotX, pivotY);
    ctx.rotate(tilt);
    ctx.translate(-pivotX, -pivotY);

    if (blink) ctx.globalAlpha = 0.5;

    // Mild squash / stretch on landing
    const sq = player.squash;
    if (sq > 0) {
      ctx.translate(x, y);
      ctx.scale(1 + sq * 0.12, 1 - sq * 0.12);
      ctx.translate(-x, -y);
    }

    // ---- Draw the frame ----
    // FIX: run frames in the sprite sheet sit a hair too high in their cells,
    // so a thin slice of the row above bleeds in at the top of the head.
    // Crop a few source pixels off the top of run frames only (other modes
    // are framed correctly and shouldn't be touched).
    const frame = currentFrame();
    const { sx, sy } = frameRect(frame);
    const RUN_TOP_BLEED = 6; // source pixels to skip from the top
    const isRun = (player.mode === MODE.RUN);
    const cropTop = isRun ? RUN_TOP_BLEED : 0;
    // Scale dest height to match the cropped source height so proportions
    // stay 1:1 (no vertical squish from cropping just the source).
    const destDrop = cropTop * (DRAW_H / FRAME_H);
    ctx.drawImage(
      G.spriteCanvas,
      sx, sy + cropTop, FRAME_W, FRAME_H - cropTop,    // source rect
      drawX, drawY + destDrop, DRAW_W, DRAW_H - destDrop // dest rect
    );

    ctx.restore();
  };

  // ============================================================
  //  Web rope
  // ============================================================
  function drawWebRope(fromX, fromY, toX, toY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#7bd3ff';
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = '#e6f7ff';
    ctx.lineWidth   = 3.5;
    ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = '#7bd3ff';
    ctx.lineWidth   = 1.4;
    ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
    // sparkles
    const dx = toX - fromX, dy = toY - fromY, len = Math.hypot(dx, dy);
    const segs = Math.min(6, Math.floor(len / 40));
    for (let i = 1; i <= segs; i++) {
      const t = i / (segs + 1);
      ctx.fillStyle = 'rgba(230,247,255,0.85)';
      ctx.beginPath();
      ctx.arc(fromX + dx * t, fromY + dy * t, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  //  Trail
  // ============================================================
  G.drawTrail = function () {
    if (!player.trail.length) return;
    ctx.save();
    for (let i = 0; i < player.trail.length; i++) {
      const t = player.trail[i];
      const a = (1 - t.age / 0.35) * 0.35;
      ctx.fillStyle = `rgba(123,211,255,${a})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4 + i * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // ============================================================
  //  Speed lines
  // ============================================================
  G.drawSpeedLines = function () {
    let intensity = 0;
    if (player.mode === MODE.SWING) {
      intensity = Math.max(0, Math.min(1, (Math.abs(player.angVel * player.ropeLen) - 200) / 600));
    } else if (player.mode === MODE.LAUNCH) {
      intensity = Math.max(0, Math.min(1, (Math.hypot(player.vx, player.vy) - 220) / 600));
    }
    if (intensity < 0.05) return;
    ctx.save();
    ctx.globalAlpha = intensity * 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    for (let i = 0; i < 6; i++) {
      const sy  = ((player.y - 80) + (i * 40 + (game.elapsed * 600) % 40)) % G.H;
      const sx1 = (player.x - 60) + ((i * 137) % 80) - 80;
      ctx.beginPath(); ctx.moveTo(sx1, sy); ctx.lineTo(sx1 + 18, sy); ctx.stroke();
    }
    ctx.restore();
  };

  // ============================================================
  //  Combo badge
  // ============================================================
  G.drawComboBadge = function () {
    if (game.combo < 2) return;
    ctx.save();
    ctx.translate(G.W * 0.5, G.H * 0.18);
    ctx.rotate(-0.05);
    ctx.font = `700 ${Math.min(34, G.W * 0.08)}px 'Sigmar', sans-serif`;
    ctx.textAlign   = 'center';
    ctx.lineWidth   = 5;
    ctx.strokeStyle = '#1a0633';
    ctx.fillStyle   = '#ffd400';
    const text = `COMBO ×${game.combo}`;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  // ============================================================
  //  Main render — back to front
  // ============================================================
  G.render = function () {
    let shx = 0, shy = 0;
    if (game.shake > 0) {
      shx = (Math.random() - 0.5) * game.shake;
      shy = (Math.random() - 0.5) * game.shake;
    }
    ctx.save();
    ctx.translate(shx, shy);

    // Birthday-photo backdrop replaces the sky + city skyline stack.
    // Still draw a few subtle clouds & birds *over* it for parallax life.
    G.drawBirthdayBg();
    G.drawClouds();
    G.drawBirds();

    G.drawEntities();   // collectibles float in front of the photo

    G.drawNearRoofs();

    // Player + trail + web
    G.drawTrail();

    if (player.mode === MODE.SWING) {
      // Wrist/hand area: ~55% from sprite top, which in screen coords is
      // sprite_top(player.y - DRAW_H*FEET_FRAC) + 55% of DRAW_H
      // = player.y - DRAW_H*(FEET_FRAC - 0.55) ≈ player.y - DRAW_H*0.38
      const handY = player.y - DRAW_H * 0.38;
      drawWebRope(player.anchorX, player.anchorY, player.x, handY, 1);
      // Pulsing anchor dot
      const pulse = 0.6 + 0.4 * Math.sin(game.elapsed * 16);
      ctx.save();
      ctx.fillStyle   = `rgba(123,211,255,${pulse})`;
      ctx.shadowColor = '#7bd3ff';
      ctx.shadowBlur  = 12;
      ctx.beginPath(); ctx.arc(player.anchorX, player.anchorY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (player.webGlow > 0) {
      // Fading web after swing release — from real last anchor, not a fake offset
      const handY = player.y - DRAW_H * 0.38;
      drawWebRope(player.lastAnchorX, player.lastAnchorY, player.x, handY, player.webGlow);
    }

    G.drawSpiderMan();
    G.drawSpeedLines();
    G.drawSilhouettes();
    G.drawParticles();
    G.drawPopups();
    G.drawComboBadge();

    ctx.restore();

    // Red damage flash overlay
    if (game.flash > 0) {
      ctx.save();
      ctx.globalAlpha = game.flash;
      ctx.fillStyle   = '#ff2a4a';
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.restore();
    }
  };
})();
