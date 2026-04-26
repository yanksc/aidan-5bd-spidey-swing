'use strict';

// ============================================================
//  SHARED NAMESPACE — set up first, all other modules extend G
// ============================================================
window.G = {};
const G = window.G;

// ---- Enums ----
G.STATE = { IDLE: 0, COUNTDOWN: 1, PLAYING: 2, OVER: 3 };
G.MODE  = { RUN: 0, JUMP: 1, SWING: 2, LAUNCH: 3 };

// ---- Canvas ----
G.canvas = document.getElementById('game');
G.ctx    = G.canvas.getContext('2d');
G.W = 0;
G.H = 0;
G.DPR = 1;

G.resize = function () {
  G.DPR = Math.min(window.devicePixelRatio || 1, 2);
  G.W = window.innerWidth;
  G.H = window.innerHeight;
  G.canvas.width  = G.W * G.DPR;
  G.canvas.height = G.H * G.DPR;
  G.canvas.style.width  = G.W + 'px';
  G.canvas.style.height = G.H + 'px';
  G.ctx.setTransform(G.DPR, 0, 0, G.DPR, 0, 0);
};
window.addEventListener('resize', G.resize);
window.addEventListener('orientationchange', G.resize);
G.resize();

// ---- Game state ----
G.state = G.STATE.IDLE;

G.game = {
  score: 0,
  combo: 0, comboTimer: 0,
  lives: 3,
  timeLeft: 60,
  elapsed: 0,
  spawnTimer: 0,
  shake: 0, flash: 0, invuln: 0,
  worldX: 0,
  speed: 280,
};

// ---- Player ----
G.player = {
  mode: G.MODE.RUN,
  x: 0, y: 0,
  vx: 0, vy: 0,
  runPhase: 0, facing: 1,
  anchorX: 0, anchorY: 0,
  lastAnchorX: 0, lastAnchorY: 0,   // saved on web release for the fading trail
  ropeLen: 220,
  angle: 0, angVel: 0,
  webGlow: 0,
  trail: [],
  squash: 0,
};

// ---- Entity / particle / popup lists ----
G.entities  = [];
G.particles = [];
G.popups    = [];

// ---- World layers ----
G.layers = { clouds: [], farSky: [], midCity: [], nearRoofs: [], silhouettes: [], birds: [] };

// ---- Input tracking ----
G.pressing   = false;
G.pressStart = 0;
G.pressX     = 0;
G.pressY     = 0;
G.lastMouseX = 0;
G.lastMouseY = 0;
