// ============================================================
// STAR TREK: DEEP SPACE NINE - USS DEFIANT
// Isometric space game
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// --- Constants ---
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const WORLD_SIZE = 6000;
const STAR_COUNT = 600;
const NEBULA_COUNT = 8;

// --- Game State ---
let gameStarted = false;
let gameTime = 0;
let score = 0;
let missionPhase = 0;
let missionTimer = 0;
let logEntries = ['> Station DS9 en vue...'];
let shakeAmount = 0;

// --- Camera ---
const camera = { x: 0, y: 0 };

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'Tab', 'KeyF', 'KeyE'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// --- Mobile Detection & Touch Controls ---
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);

const touch = {
    joystickX: 0,    // -1 to 1
    joystickY: 0,    // -1 to 1
    joystickActive: false,
    fire: false,
    torpedo: false,
    shield: false,
    turbo: false,
    joystickTouchId: null
};

function initTouchControls() {
    const touchControls = document.getElementById('touch-controls');
    touchControls.classList.add('active');

    const joystickZone = document.getElementById('joystick-zone');
    const joystickThumb = document.getElementById('joystick-thumb');
    const joystickBase = document.getElementById('joystick-base');

    const maxDist = 50;

    function getJoystickCenter() {
        const rect = joystickBase.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    joystickZone.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        touch.joystickTouchId = t.identifier;
        touch.joystickActive = true;
        updateJoystick(t);
    }, { passive: false });

    joystickZone.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touch.joystickTouchId) {
                updateJoystick(e.changedTouches[i]);
            }
        }
    }, { passive: false });

    joystickZone.addEventListener('touchend', e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touch.joystickTouchId) {
                touch.joystickActive = false;
                touch.joystickX = 0;
                touch.joystickY = 0;
                touch.joystickTouchId = null;
                joystickThumb.style.left = '50%';
                joystickThumb.style.top = '50%';
                joystickThumb.style.transform = 'translate(-50%, -50%)';
            }
        }
    });

    function updateJoystick(t) {
        const center = getJoystickCenter();
        let dx = t.clientX - center.x;
        let dy = t.clientY - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        touch.joystickX = dx / maxDist;
        touch.joystickY = dy / maxDist;

        const baseRect = joystickBase.getBoundingClientRect();
        const zoneRect = joystickZone.getBoundingClientRect();
        const thumbX = (baseRect.left - zoneRect.left) + baseRect.width / 2 + dx;
        const thumbY = (baseRect.top - zoneRect.top) + baseRect.height / 2 + dy;
        joystickThumb.style.left = thumbX + 'px';
        joystickThumb.style.top = thumbY + 'px';
        joystickThumb.style.transform = 'translate(-50%, -50%)';
    }

    // Action buttons
    function setupButton(id, key) {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', e => {
            e.preventDefault();
            touch[key] = true;
            btn.classList.add('pressed');
        }, { passive: false });
        btn.addEventListener('touchend', e => {
            e.preventDefault();
            touch[key] = false;
            btn.classList.remove('pressed');
        }, { passive: false });
        btn.addEventListener('touchcancel', e => {
            touch[key] = false;
            btn.classList.remove('pressed');
        });
    }

    setupButton('btn-fire', 'fire');
    setupButton('btn-torpedo', 'torpedo');
    setupButton('btn-shield', 'shield');
    setupButton('btn-turbo', 'turbo');

    // Prevent default touch behaviors on canvas
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

if (isMobile) {
    document.addEventListener('DOMContentLoaded', () => {
        // Will be initialized on game start
    });
}

// --- Resize ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const mmSize = window.innerWidth < 768 ? 120 : 180;
    minimapCanvas.width = mmSize;
    minimapCanvas.height = mmSize;
}
window.addEventListener('resize', resize);
resize();

// --- Isometric Helpers ---
function toIso(x, y) {
    return {
        x: (x - y) * Math.cos(ISO_ANGLE),
        y: (x + y) * Math.sin(ISO_ANGLE)
    };
}

function worldToScreen(wx, wy) {
    const iso = toIso(wx, wy);
    return {
        x: iso.x - camera.x + canvas.width / 2,
        y: iso.y - camera.y + canvas.height / 2
    };
}

// --- Stars background ---
const stars = [];
for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
        x: (Math.random() - 0.5) * WORLD_SIZE * 2,
        y: (Math.random() - 0.5) * WORLD_SIZE * 2,
        brightness: Math.random() * 0.7 + 0.3,
        size: Math.random() * 1.5 + 0.5,
        twinkleSpeed: Math.random() * 0.02 + 0.005
    });
}

// --- Nebulae ---
const nebulae = [];
for (let i = 0; i < NEBULA_COUNT; i++) {
    nebulae.push({
        x: (Math.random() - 0.5) * WORLD_SIZE * 1.5,
        y: (Math.random() - 0.5) * WORLD_SIZE * 1.5,
        radius: Math.random() * 300 + 150,
        color: ['#1a0033', '#001a33', '#0a1a00', '#330a00'][Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.15 + 0.05
    });
}

// --- Deep Space Nine Station ---
const ds9 = {
    x: 0, y: 0,
    rotation: 0,
    dockingPorts: []
};
// Generate docking pylons positions
for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ds9.dockingPorts.push({ angle, ship: null });
}

// --- USS Defiant ---
const defiant = {
    x: -300, y: -300,
    vx: 0, vy: 0,
    angle: Math.PI / 4,
    speed: 0,
    maxSpeed: 4,
    turboSpeed: 7,
    hull: 100,
    shields: 100,
    shieldsActive: false,
    shieldCooldown: 0,
    torpedoes: 20,
    phaserCooldown: 0,
    torpedoCooldown: 0,
    engineTrail: [],
    cloaked: false
};

// --- Projectiles ---
let phasers = [];
let torpedoes = [];
let explosions = [];
let particles = [];

// --- Enemies ---
let enemies = [];
const ENEMY_TYPES = {
    jemhadar: { name: "Jem'Hadar", color: '#9933ff', hull: 40, speed: 2.5, fireRate: 120, score: 100, size: 14 },
    cardassian: { name: 'Cardassien', color: '#ccaa00', hull: 50, speed: 2, fireRate: 150, score: 80, size: 16 },
    breen: { name: 'Breen', color: '#00cccc', hull: 60, speed: 1.8, fireRate: 100, score: 120, size: 15 },
    borg: { name: 'Borg', color: '#00ff00', hull: 150, speed: 1.5, fireRate: 80, score: 300, size: 22 }
};

// --- Friendly ships ---
let friendlies = [];

// --- Asteroids ---
let asteroids = [];
for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1500 + Math.random() * 2000;
    asteroids.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: Math.random() * 20 + 8,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.01,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vertices: []
    });
}
// Generate asteroid shapes
asteroids.forEach(a => {
    const numVerts = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numVerts; i++) {
        const ang = (i / numVerts) * Math.PI * 2;
        const r = a.size * (0.7 + Math.random() * 0.3);
        a.vertices.push({ angle: ang, r });
    }
});

// --- Wormhole ---
const wormhole = {
    x: 800, y: 800,
    radius: 60,
    pulsePhase: 0,
    active: true
};

// ============================================================
// DRAWING FUNCTIONS
// ============================================================

function drawStars() {
    stars.forEach(star => {
        const parallax = 0.3;
        const sx = star.x * parallax - camera.x * parallax + canvas.width / 2;
        const sy = star.y * parallax - camera.y * parallax + canvas.height / 2;
        if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) return;
        const twinkle = Math.sin(gameTime * star.twinkleSpeed) * 0.3 + 0.7;
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawNebulae() {
    nebulae.forEach(n => {
        const pos = worldToScreen(n.x, n.y);
        if (Math.abs(pos.x - canvas.width/2) > canvas.width && Math.abs(pos.y - canvas.height/2) > canvas.height) return;
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, n.radius);
        grad.addColorStop(0, n.color + '40');
        grad.addColorStop(0.5, n.color + '20');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawDS9(pos) {
    const s = 1; // scale
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(ds9.rotation);

    // Outer ring
    ctx.strokeStyle = '#886644';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 90 * s, 45 * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring glow
    ctx.strokeStyle = '#ff880044';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 90 * s, 45 * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Second ring
    ctx.strokeStyle = '#776655';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70 * s, 35 * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner habitat ring
    ctx.strokeStyle = '#998877';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 45 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Docking pylons (6)
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + ds9.rotation;
        const outerX = Math.cos(angle) * 95 * s;
        const outerY = Math.sin(angle) * 47 * s;
        const innerX = Math.cos(angle) * 50 * s;
        const innerY = Math.sin(angle) * 25 * s;

        ctx.strokeStyle = '#665544';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();

        // Pylon tip light
        const blink = Math.sin(gameTime * 0.03 + i) > 0 ? 1 : 0.3;
        ctx.fillStyle = `rgba(255, 136, 0, ${blink})`;
        ctx.beginPath();
        ctx.arc(outerX, outerY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Central core (Ops)
    const grad = ctx.createRadialGradient(0, -5, 0, 0, -5, 25 * s);
    grad.addColorStop(0, '#ffaa66');
    grad.addColorStop(0.4, '#996644');
    grad.addColorStop(1, '#443322');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -5, 25 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ops windows glow
    ctx.fillStyle = `rgba(255, 170, 50, ${0.5 + Math.sin(gameTime * 0.02) * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(0, -5, 8 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Promenade lights
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const lx = Math.cos(a) * 45 * s;
        const ly = Math.sin(a) * 22 * s;
        const blink = Math.sin(gameTime * 0.01 + i * 0.5) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 200, 100, ${blink * 0.6})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // DS9 label
    ctx.fillStyle = 'rgba(255, 153, 0, 0.6)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('DEEP SPACE 9', 0, 60 * s);

    ctx.restore();
}

function drawDefiant(pos) {
    ctx.save();
    ctx.translate(pos.x, pos.y);

    const dir = defiant.angle;

    // Engine trail
    if (defiant.speed > 0.5) {
        defiant.engineTrail.push({
            x: defiant.x - Math.cos(dir) * 15,
            y: defiant.y - Math.sin(dir) * 15,
            life: 30,
            maxLife: 30
        });
    }

    // Shield bubble
    if (defiant.shieldsActive && defiant.shields > 0) {
        const shieldAlpha = 0.15 + Math.sin(gameTime * 0.1) * 0.05;
        const shieldGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
        shieldGrad.addColorStop(0, `rgba(100, 150, 255, 0)`);
        shieldGrad.addColorStop(0.7, `rgba(100, 150, 255, ${shieldAlpha})`);
        shieldGrad.addColorStop(1, `rgba(100, 150, 255, 0)`);
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ship body - compact Defiant shape
    ctx.rotate(dir - Math.PI / 4);

    // Main hull
    ctx.fillStyle = '#8899aa';
    ctx.beginPath();
    ctx.moveTo(18, 0);      // Nose
    ctx.lineTo(5, -8);      // Left front
    ctx.lineTo(-10, -10);   // Left wing
    ctx.lineTo(-15, -5);    // Left back
    ctx.lineTo(-15, 5);     // Right back
    ctx.lineTo(-10, 10);    // Right wing
    ctx.lineTo(5, 8);       // Right front
    ctx.closePath();
    ctx.fill();

    // Hull details
    ctx.strokeStyle = '#667788';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Bridge section
    ctx.fillStyle = '#99aacc';
    ctx.beginPath();
    ctx.ellipse(8, 0, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bridge window
    ctx.fillStyle = `rgba(150, 200, 255, ${0.6 + Math.sin(gameTime * 0.05) * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(10, 0, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nacelles
    ctx.fillStyle = '#6677aa';
    ctx.fillRect(-14, -11, 8, 3);
    ctx.fillRect(-14, 8, 8, 3);

    // Nacelle glow
    const engineGlow = defiant.speed > 0.5 ? 0.8 : 0.3;
    ctx.fillStyle = `rgba(100, 150, 255, ${engineGlow})`;
    ctx.fillRect(-15, -11, 2, 3);
    ctx.fillRect(-15, 8, 2, 3);

    // Impulse engine glow
    if (defiant.speed > 0.5) {
        const turbo = keys['ShiftLeft'] || keys['ShiftRight'] || touch.turbo;
        const engineColor = turbo ? 'rgba(255, 150, 50, 0.8)' : 'rgba(255, 100, 50, 0.6)';
        const engineSize = turbo ? 12 : 8;
        const grad = ctx.createRadialGradient(-15, 0, 0, -15, 0, engineSize);
        grad.addColorStop(0, engineColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(-15, 0, engineSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Defiant label
    ctx.rotate(-(dir - Math.PI / 4));
    ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('DEFIANT', 0, 25);

    ctx.restore();
}

function drawEnemy(enemy) {
    const pos = worldToScreen(enemy.x, enemy.y);
    if (pos.x < -50 || pos.x > canvas.width + 50 || pos.y < -50 || pos.y > canvas.height + 50) return;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(enemy.angle - Math.PI / 4);

    const type = ENEMY_TYPES[enemy.type];
    const s = type.size;

    if (enemy.type === 'jemhadar') {
        // Jem'Hadar attack ship - insect-like
        ctx.fillStyle = '#6622aa';
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(-s * 0.8, -s * 0.5);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.8, s * 0.5);
        ctx.lineTo(0, s * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#9944ff';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Engine glow
        ctx.fillStyle = 'rgba(153, 51, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-s, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    } else if (enemy.type === 'cardassian') {
        // Cardassian Galor class
        ctx.fillStyle = '#aa8800';
        ctx.beginPath();
        ctx.moveTo(s * 1.2, 0);
        ctx.lineTo(s * 0.3, -s * 0.3);
        ctx.lineTo(-s * 0.5, -s * 0.8);
        ctx.lineTo(-s, -s * 0.3);
        ctx.lineTo(-s, s * 0.3);
        ctx.lineTo(-s * 0.5, s * 0.8);
        ctx.lineTo(s * 0.3, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ccaa00';
        ctx.lineWidth = 1;
        ctx.stroke();
    } else if (enemy.type === 'breen') {
        // Breen warship
        ctx.fillStyle = '#008888';
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(0, -s);
        ctx.lineTo(-s * 0.6, -s * 0.4);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.6, s * 0.4);
        ctx.lineTo(0, s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#00cccc';
        ctx.lineWidth = 1;
        ctx.stroke();
    } else if (enemy.type === 'borg') {
        // Borg cube
        ctx.fillStyle = '#115511';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        // Grid lines
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 0.5;
        for (let i = -s / 2; i < s / 2; i += s / 4) {
            ctx.beginPath();
            ctx.moveTo(i, -s / 2);
            ctx.lineTo(i, s / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s / 2, i);
            ctx.lineTo(s / 2, i);
            ctx.stroke();
        }
        // Green glow
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
    }

    ctx.restore();

    // Health bar
    if (enemy.hull < ENEMY_TYPES[enemy.type].hull) {
        const hpPct = enemy.hull / ENEMY_TYPES[enemy.type].hull;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(pos.x - 15, pos.y - type.size - 8, 30, 3);
        ctx.fillStyle = hpPct > 0.5 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 100, 0, 0.7)';
        ctx.fillRect(pos.x - 15, pos.y - type.size - 8, 30 * hpPct, 3);
    }

    // Name tag
    ctx.fillStyle = type.color + '88';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(type.name, pos.x, pos.y + type.size + 12);
}

function drawWormhole() {
    const pos = worldToScreen(wormhole.x, wormhole.y);
    if (pos.x < -100 || pos.x > canvas.width + 100 || pos.y < -100 || pos.y > canvas.height + 100) return;

    wormhole.pulsePhase += 0.02;

    // Outer swirl
    for (let ring = 5; ring >= 0; ring--) {
        const r = wormhole.radius - ring * 8 + Math.sin(wormhole.pulsePhase + ring) * 5;
        const alpha = 0.1 + ring * 0.03;
        const hue = 200 + ring * 15 + Math.sin(wormhole.pulsePhase) * 20;
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, r, r * 0.5, Math.sin(wormhole.pulsePhase * 0.5) * 0.2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Central glow
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 40);
    grad.addColorStop(0, `rgba(200, 220, 255, ${0.4 + Math.sin(wormhole.pulsePhase) * 0.2})`);
    grad.addColorStop(0.5, 'rgba(100, 150, 255, 0.15)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('TROU DE VER BAJORAN', pos.x, pos.y + wormhole.radius + 15);
}

function drawAsteroids() {
    asteroids.forEach(a => {
        const pos = worldToScreen(a.x, a.y);
        if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) return;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(a.rotation);

        ctx.fillStyle = '#554433';
        ctx.strokeStyle = '#776655';
        ctx.lineWidth = 1;
        ctx.beginPath();
        a.vertices.forEach((v, i) => {
            const vx = Math.cos(v.angle) * v.r;
            const vy = Math.sin(v.angle) * v.r * 0.6; // iso squash
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    });
}

function drawPhaser(p) {
    const pos = worldToScreen(p.x, p.y);
    const endPos = worldToScreen(p.x - Math.cos(p.angle) * 20, p.y - Math.sin(p.angle) * 20);

    ctx.strokeStyle = p.friendly ? 'rgba(255, 150, 50, 0.9)' : 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    // Glow
    ctx.strokeStyle = p.friendly ? 'rgba(255, 200, 100, 0.3)' : 'rgba(255, 100, 100, 0.3)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();
}

function drawTorpedo(t) {
    const pos = worldToScreen(t.x, t.y);

    // Torpedo glow
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 10);
    grad.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
    grad.addColorStop(0.5, 'rgba(50, 100, 255, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawExplosion(exp) {
    const pos = worldToScreen(exp.x, exp.y);
    const progress = 1 - exp.life / exp.maxLife;
    const radius = exp.size * (0.5 + progress);
    const alpha = 1 - progress;

    // Flash
    if (progress < 0.3) {
        const flashGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2);
        flashGrad.addColorStop(0, `rgba(255, 255, 200, ${alpha * 0.5})`);
        flashGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Fire ball
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
    grad.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.7})`);
    grad.addColorStop(1, `rgba(200, 50, 0, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawEngineTrails() {
    defiant.engineTrail.forEach(t => {
        const pos = worldToScreen(t.x, t.y);
        const alpha = (t.life / t.maxLife) * 0.4;
        const size = (t.life / t.maxLife) * 3;
        ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawParticles() {
    particles.forEach(p => {
        const pos = worldToScreen(p.x, p.y);
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawMinimap() {
    const mmW = minimapCanvas.width;
    const mmH = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, mmW, mmH);
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    minimapCtx.fillRect(0, 0, mmW, mmH);

    const scale = mmW / (WORLD_SIZE * 1.5);
    const cx = mmW / 2, cy = mmH / 2;

    // DS9
    minimapCtx.fillStyle = '#ff8800';
    minimapCtx.beginPath();
    minimapCtx.arc(cx + ds9.x * scale, cy + ds9.y * scale, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    // Wormhole
    minimapCtx.fillStyle = '#6699ff';
    minimapCtx.beginPath();
    minimapCtx.arc(cx + wormhole.x * scale, cy + wormhole.y * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();

    // Enemies
    enemies.forEach(e => {
        minimapCtx.fillStyle = ENEMY_TYPES[e.type].color;
        minimapCtx.fillRect(cx + e.x * scale - 1, cy + e.y * scale - 1, 3, 3);
    });

    // Defiant
    minimapCtx.fillStyle = '#00ff00';
    minimapCtx.beginPath();
    minimapCtx.arc(cx + defiant.x * scale, cy + defiant.y * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();

    // Camera box
    const boxW = canvas.width / 3 * scale;
    const boxH = canvas.height / 3 * scale;
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(cx + defiant.x * scale - boxW / 2, cy + defiant.y * scale - boxH / 2, boxW, boxH);

    // Border
    minimapCtx.strokeStyle = '#ff6600';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, mmW, mmH);
}

// ============================================================
// UPDATE FUNCTIONS
// ============================================================

function updateDefiant() {
    const turbo = keys['ShiftLeft'] || keys['ShiftRight'] || touch.turbo;
    const maxSpd = turbo ? defiant.turboSpeed : defiant.maxSpeed;
    const accel = 0.12;
    const friction = 0.97;
    const turnSpeed = 0.04;

    // Rotation (keyboard)
    let turning = false;
    if (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft']) { defiant.angle -= turnSpeed; turning = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { defiant.angle += turnSpeed; turning = true; }

    // Thrust (keyboard)
    if (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp']) {
        defiant.vx += Math.cos(defiant.angle) * accel;
        defiant.vy += Math.sin(defiant.angle) * accel;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        defiant.vx -= Math.cos(defiant.angle) * accel * 0.5;
        defiant.vy -= Math.sin(defiant.angle) * accel * 0.5;
    }

    // Touch joystick input
    if (touch.joystickActive) {
        const jx = touch.joystickX;
        const jy = touch.joystickY;
        const jMag = Math.sqrt(jx * jx + jy * jy);

        if (jMag > 0.15) {
            // Smoothly rotate toward joystick direction
            const targetAngle = Math.atan2(jy, jx);
            let angleDiff = targetAngle - defiant.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            defiant.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnSpeed * 1.5);

            // Thrust proportional to joystick magnitude
            defiant.vx += Math.cos(defiant.angle) * accel * jMag;
            defiant.vy += Math.sin(defiant.angle) * accel * jMag;
        }
    }

    // Apply friction
    defiant.vx *= friction;
    defiant.vy *= friction;

    // Cap speed
    defiant.speed = Math.sqrt(defiant.vx * defiant.vx + defiant.vy * defiant.vy);
    if (defiant.speed > maxSpd) {
        defiant.vx = (defiant.vx / defiant.speed) * maxSpd;
        defiant.vy = (defiant.vy / defiant.speed) * maxSpd;
        defiant.speed = maxSpd;
    }

    defiant.x += defiant.vx;
    defiant.y += defiant.vy;

    // World bounds
    const bound = WORLD_SIZE / 2;
    if (defiant.x < -bound) defiant.x = -bound;
    if (defiant.x > bound) defiant.x = bound;
    if (defiant.y < -bound) defiant.y = -bound;
    if (defiant.y > bound) defiant.y = bound;

    // Shields
    if ((keys['KeyE'] || touch.shield) && defiant.shieldCooldown <= 0) {
        defiant.shieldsActive = !defiant.shieldsActive;
        defiant.shieldCooldown = 20;
    }
    if (defiant.shieldCooldown > 0) defiant.shieldCooldown--;

    // Shield drain
    if (defiant.shieldsActive) {
        defiant.shields = Math.max(0, defiant.shields - 0.02);
        if (defiant.shields <= 0) defiant.shieldsActive = false;
    } else {
        defiant.shields = Math.min(100, defiant.shields + 0.01);
    }

    // Phasers
    if (defiant.phaserCooldown > 0) defiant.phaserCooldown--;
    if ((keys['Space'] || touch.fire) && defiant.phaserCooldown <= 0) {
        firePhasers();
        defiant.phaserCooldown = 10;
    }

    // Torpedoes
    if (defiant.torpedoCooldown > 0) defiant.torpedoCooldown--;
    if ((keys['KeyF'] || touch.torpedo) && defiant.torpedoCooldown <= 0 && defiant.torpedoes > 0) {
        fireTorpedo();
        defiant.torpedoCooldown = 30;
    }

    // Engine trail cleanup
    defiant.engineTrail = defiant.engineTrail.filter(t => {
        t.life--;
        return t.life > 0;
    });

    // Asteroid collision
    asteroids.forEach(a => {
        const dx = defiant.x - a.x;
        const dy = defiant.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.size + 12) {
            takeDamage(5);
            defiant.vx = dx / dist * 3;
            defiant.vy = dy / dist * 3;
            spawnParticles(a.x, a.y, 5, 150, 120, 80);
        }
    });

    // DS9 proximity for hull repair
    const dxDS9 = defiant.x - ds9.x;
    const dyDS9 = defiant.y - ds9.y;
    const distDS9 = Math.sqrt(dxDS9 * dxDS9 + dyDS9 * dyDS9);
    if (distDS9 < 150) {
        defiant.hull = Math.min(100, defiant.hull + 0.05);
        defiant.shields = Math.min(100, defiant.shields + 0.03);
        if (defiant.torpedoes < 20 && gameTime % 60 === 0) defiant.torpedoes++;
    }
}

function firePhasers() {
    const spread = 0.05;
    for (let i = -1; i <= 1; i += 2) {
        phasers.push({
            x: defiant.x + Math.cos(defiant.angle) * 18,
            y: defiant.y + Math.sin(defiant.angle) * 18,
            angle: defiant.angle + i * spread,
            speed: 12,
            life: 40,
            damage: 8,
            friendly: true
        });
    }
}

function fireTorpedo() {
    torpedoes.push({
        x: defiant.x + Math.cos(defiant.angle) * 20,
        y: defiant.y + Math.sin(defiant.angle) * 20,
        angle: defiant.angle,
        speed: 6,
        life: 120,
        damage: 35,
        friendly: true
    });
    defiant.torpedoes--;
}

function takeDamage(amount) {
    if (defiant.shieldsActive && defiant.shields > 0) {
        defiant.shields -= amount * 0.8;
        defiant.hull -= amount * 0.2;
    } else {
        defiant.hull -= amount;
    }
    shakeAmount = Math.min(shakeAmount + amount * 0.5, 15);
    if (defiant.hull <= 0) {
        gameOver();
    }
}

function gameOver() {
    defiant.hull = 0;
    explosions.push({
        x: defiant.x, y: defiant.y,
        life: 60, maxLife: 60, size: 50
    });
    addLog('> USS DEFIANT DÉTRUIT! Score final: ' + score);
    setTimeout(() => {
        defiant.hull = 100;
        defiant.shields = 100;
        defiant.torpedoes = 20;
        defiant.x = -300;
        defiant.y = -300;
        defiant.vx = 0;
        defiant.vy = 0;
        score = Math.max(0, score - 200);
        addLog('> Defiant reconstruit à DS9...');
    }, 3000);
}

function updateProjectiles() {
    // Update phasers
    phasers = phasers.filter(p => {
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.life--;

        if (p.friendly) {
            // Check hit on enemies
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < ENEMY_TYPES[e.type].size + 5) {
                    e.hull -= p.damage;
                    spawnParticles(p.x, p.y, 3, 255, 150, 50);
                    if (e.hull <= 0) {
                        destroyEnemy(i);
                    }
                    return false;
                }
            }
        } else {
            // Enemy phaser hit player
            const dx = p.x - defiant.x;
            const dy = p.y - defiant.y;
            if (Math.sqrt(dx * dx + dy * dy) < 15) {
                takeDamage(p.damage);
                spawnParticles(p.x, p.y, 3, 255, 100, 100);
                return false;
            }
        }

        return p.life > 0;
    });

    // Update torpedoes
    torpedoes = torpedoes.filter(t => {
        t.x += Math.cos(t.angle) * t.speed;
        t.y += Math.sin(t.angle) * t.speed;
        t.life--;

        if (t.friendly) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                const dx = t.x - e.x;
                const dy = t.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < ENEMY_TYPES[e.type].size + 8) {
                    e.hull -= t.damage;
                    explosions.push({
                        x: t.x, y: t.y,
                        life: 30, maxLife: 30, size: 25
                    });
                    if (e.hull <= 0) {
                        destroyEnemy(i);
                    }
                    return false;
                }
            }
        }

        // Hit asteroids
        for (let a of asteroids) {
            const dx = t.x - a.x;
            const dy = t.y - a.y;
            if (Math.sqrt(dx * dx + dy * dy) < a.size + 5) {
                explosions.push({ x: t.x, y: t.y, life: 20, maxLife: 20, size: 15 });
                spawnParticles(t.x, t.y, 8, 150, 120, 80);
                return false;
            }
        }

        return t.life > 0;
    });

    // Update explosions
    explosions = explosions.filter(e => {
        e.life--;
        return e.life > 0;
    });

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
    });
}

function destroyEnemy(index) {
    const e = enemies[index];
    const type = ENEMY_TYPES[e.type];
    score += type.score;
    explosions.push({
        x: e.x, y: e.y,
        life: 40, maxLife: 40, size: type.size * 2
    });
    spawnParticles(e.x, e.y, 15, 255, 150, 50);
    addLog(`> ${type.name} détruit! +${type.score} pts`);
    enemies.splice(index, 1);
}

function spawnParticles(x, y, count, r, g, b) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            size: Math.random() * 3 + 1,
            r, g, b
        });
    }
}

function updateEnemies() {
    enemies.forEach(e => {
        const dx = defiant.x - e.x;
        const dy = defiant.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const type = ENEMY_TYPES[e.type];

        // AI: pursue player
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - e.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        e.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.03);

        if (dist > 100) {
            e.x += Math.cos(e.angle) * type.speed;
            e.y += Math.sin(e.angle) * type.speed;
        } else if (dist < 60) {
            // Back off slightly
            e.x -= Math.cos(e.angle) * type.speed * 0.5;
            e.y -= Math.sin(e.angle) * type.speed * 0.5;
        }

        // Fire at player
        e.fireCooldown--;
        if (e.fireCooldown <= 0 && dist < 500) {
            e.fireCooldown = type.fireRate;
            phasers.push({
                x: e.x + Math.cos(e.angle) * type.size,
                y: e.y + Math.sin(e.angle) * type.size,
                angle: targetAngle,
                speed: 8,
                life: 50,
                damage: 5,
                friendly: false
            });
        }
    });
}

function updateAsteroids() {
    asteroids.forEach(a => {
        a.x += a.vx;
        a.y += a.vy;
        a.rotation += a.rotSpeed;
    });
}

// ============================================================
// MISSION SYSTEM
// ============================================================

const missions = [
    {
        name: 'Patrouille autour de DS9',
        desc: 'Défendez la station contre les attaquants',
        spawn: () => spawnWave('jemhadar', 3),
        check: () => enemies.length === 0,
        reward: 200
    },
    {
        name: 'Menace Cardassienne',
        desc: 'Un groupe Cardassien approche!',
        spawn: () => spawnWave('cardassian', 4),
        check: () => enemies.length === 0,
        reward: 300
    },
    {
        name: 'Raid Breen',
        desc: 'Des vaisseaux Breen sont sortis du trou de ver!',
        spawn: () => { spawnWave('breen', 3); spawnWave('jemhadar', 2); },
        check: () => enemies.length === 0,
        reward: 500
    },
    {
        name: 'Incursion Borg',
        desc: 'Un cube Borg détecté! Toutes mains au poste de combat!',
        spawn: () => { spawnWave('borg', 1); spawnWave('jemhadar', 3); },
        check: () => enemies.length === 0,
        reward: 800
    },
    {
        name: 'Assaut du Dominion',
        desc: 'Le Dominion lance une attaque massive!',
        spawn: () => { spawnWave('jemhadar', 5); spawnWave('cardassian', 3); spawnWave('breen', 2); },
        check: () => enemies.length === 0,
        reward: 1000
    }
];

function spawnWave(type, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1200 + Math.random() * 500;
        enemies.push({
            type,
            x: defiant.x + Math.cos(angle) * dist,
            y: defiant.y + Math.sin(angle) * dist,
            angle: Math.random() * Math.PI * 2,
            hull: ENEMY_TYPES[type].hull,
            fireCooldown: ENEMY_TYPES[type].fireRate
        });
    }
}

function updateMissions() {
    missionTimer++;
    if (enemies.length === 0 && missionTimer > 300) {
        const mission = missions[missionPhase % missions.length];
        addLog(`> MISSION: ${mission.name}`);
        addLog(`> ${mission.desc}`);
        document.getElementById('mission-text').textContent = mission.name;
        mission.spawn();
        missionTimer = 0;
        missionPhase++;
    }

    if (enemies.length === 0 && missionTimer === 1 && missionPhase > 0) {
        const prevMission = missions[(missionPhase - 1) % missions.length];
        score += prevMission.reward;
        addLog(`> Mission accomplie! +${prevMission.reward} pts`);
    }
}

function addLog(text) {
    logEntries.push(text);
    if (logEntries.length > 6) logEntries.shift();
    const logDiv = document.getElementById('mission-log');
    logDiv.innerHTML = logEntries.map(e => `<div class="log-entry">${e}</div>`).join('');
}

// ============================================================
// MAIN LOOP
// ============================================================

function update() {
    if (!gameStarted) return;
    gameTime++;

    updateDefiant();
    updateEnemies();
    updateProjectiles();
    updateAsteroids();
    updateMissions();

    ds9.rotation += 0.0005;

    // Shake decay
    shakeAmount *= 0.9;
    if (shakeAmount < 0.1) shakeAmount = 0;

    // Camera follow defiant
    const isoPos = toIso(defiant.x, defiant.y);
    camera.x += (isoPos.x - camera.x) * 0.08;
    camera.y += (isoPos.y - camera.y) * 0.08;

    // Update HUD
    document.getElementById('hull').textContent = Math.max(0, Math.round(defiant.hull));
    document.getElementById('shields').textContent = Math.round(defiant.shields);
    document.getElementById('score').textContent = score;
    document.getElementById('phaser-status').textContent = defiant.phaserCooldown > 0 ? 'RECHARGE' : 'PRÊT';
    document.getElementById('torpedo-count').textContent = defiant.torpedoes;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply screen shake
    ctx.save();
    if (shakeAmount > 0) {
        ctx.translate(
            (Math.random() - 0.5) * shakeAmount,
            (Math.random() - 0.5) * shakeAmount
        );
    }

    // Background
    drawStars();
    drawNebulae();

    // Engine trails
    drawEngineTrails();

    // Wormhole
    drawWormhole();

    // Asteroids
    drawAsteroids();

    // DS9
    const ds9Pos = worldToScreen(ds9.x, ds9.y);
    drawDS9(ds9Pos);

    // Enemies
    enemies.forEach(e => drawEnemy(e));

    // Defiant
    if (defiant.hull > 0) {
        const defPos = worldToScreen(defiant.x, defiant.y);
        drawDefiant(defPos);
    }

    // Projectiles
    phasers.forEach(p => drawPhaser(p));
    torpedoes.forEach(t => drawTorpedo(t));

    // Explosions & particles
    explosions.forEach(e => drawExplosion(e));
    drawParticles();

    ctx.restore();

    // Minimap
    drawMinimap();
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// --- Start ---
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('minimap').style.display = 'block';
    document.getElementById('mission-log').style.display = 'block';
    gameStarted = true;
    addLog('> USS Defiant prêt au lancement.');
    addLog('> Capitaine, la station est en vue.');

    if (isMobile) {
        initTouchControls();
    }
});

gameLoop();
