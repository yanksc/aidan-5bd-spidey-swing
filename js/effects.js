'use strict';

// ============================================================
//  EFFECTS — particles, score popups, web dust
// ============================================================
(function () {
  const particles = G.particles;
  const popups    = G.popups;
  const ctx       = G.ctx;

  G.burst = function (x, y, color, count, speed) {
    speed = speed || 240;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
        life: 0.55 + Math.random() * 0.5, age: 0,
        color, size: 2.5 + Math.random() * 4, gravity: true,
      });
    }
  };

  G.webDust = function (x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60 - 30,
        life: 0.4, age: 0,
        color: 'rgba(230,247,255,0.85)', size: 1.6 + Math.random() * 1.4, gravity: false,
      });
    }
  };

  G.popup = function (x, y, text, color) {
    popups.push({ x, y, vy: -90, life: 0.9, age: 0, text, color });
  };

  G.updateParticles = function (dt) {
    for (const p of particles) {
      p.age += dt;
      p.x   += p.vx * dt;
      p.y   += p.vy * dt;
      if (p.gravity) p.vy += 380 * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    }
  };

  G.updatePopups = function (dt) {
    for (const p of popups) { p.age += dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    for (let i = popups.length - 1; i >= 0; i--) {
      if (popups[i].age >= popups[i].life) popups.splice(i, 1);
    }
  };

  G.drawParticles = function () {
    for (const p of particles) {
      const a = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  G.drawPopups = function () {
    ctx.save();
    ctx.font = "700 22px 'Sigmar', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1a0633';
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  };
})();
