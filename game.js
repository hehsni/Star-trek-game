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
    jemhadar: { name: "Jem'Hadar", color: '#9944ff', hull: 40, speed: 2.5, fireRate: 120, score: 100, size: 18 },
    cardassian: { name: 'Cardassien', color: '#ccaa00', hull: 50, speed: 2, fireRate: 150, score: 80, size: 20 },
    breen: { name: 'Breen', color: '#00cccc', hull: 60, speed: 1.8, fireRate: 100, score: 120, size: 18 },
    borg: { name: 'Borg', color: '#00ff00', hull: 150, speed: 1.5, fireRate: 80, score: 300, size: 28 }
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
    ctx.save();
    ctx.translate(pos.x, pos.y);

    const rot = ds9.rotation;
    // DS9 is viewed top-down in iso perspective
    // The station has: outer docking ring, habitat ring, promenade, central core
    // Connected by 3 pairs of upper/lower docking pylons and crossover bridges

    // === Ambient glow around the whole station ===
    const ambGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 140);
    ambGrad.addColorStop(0, 'rgba(255, 160, 80, 0.06)');
    ambGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.fill();

    // === Outer Docking Ring (the big outer circle) ===
    // Thick filled ring
    ctx.strokeStyle = '#7a6a55';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, 105, 52, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Ring inner edge
    ctx.strokeStyle = '#5a4a38';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 101, 50, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Ring outer edge highlight
    ctx.strokeStyle = '#9a8a70';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 109, 54, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Docking ring segment lights (windows on the ring)
    for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2 + rot;
        const lx = Math.cos(a) * 105;
        const ly = Math.sin(a) * 52;
        const blink = Math.sin(gameTime * 0.008 + i * 0.4) * 0.2 + 0.5;
        ctx.fillStyle = `rgba(255, 200, 130, ${blink})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    // === 6 Docking Pylons (3 upper arching up, 3 lower arching down) ===
    // They connect outer ring to inner habitat ring, curving outward
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rot;
        const isUpper = i % 2 === 0;

        // Pylon base on habitat ring
        const innerX = Math.cos(a) * 58;
        const innerY = Math.sin(a) * 29;
        // Pylon tip on docking ring
        const outerX = Math.cos(a) * 105;
        const outerY = Math.sin(a) * 52;
        // Control point for curve (arch effect)
        const midX = Math.cos(a) * 85;
        const midY = Math.sin(a) * 42 + (isUpper ? -12 : 8);

        ctx.strokeStyle = '#8a7a60';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.quadraticCurveTo(midX, midY, outerX, outerY);
        ctx.stroke();

        // Pylon structural detail line
        ctx.strokeStyle = '#6a5a45';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.quadraticCurveTo(midX + (isUpper ? -2 : 2), midY + (isUpper ? -2 : 2), outerX, outerY);
        ctx.stroke();

        // Pylon tip docking port (small rectangle-ish shape)
        ctx.fillStyle = '#9a8a70';
        ctx.beginPath();
        ctx.arc(outerX, outerY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Running light on pylon tip
        const blink = Math.sin(gameTime * 0.04 + i * 1.05) > 0.3 ? 1 : 0.2;
        ctx.fillStyle = `rgba(255, 120, 40, ${blink})`;
        ctx.beginPath();
        ctx.arc(outerX, outerY, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // === Crossover Bridges (3 straight connectors, thinner) ===
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + rot + Math.PI / 6;
        const innerX = Math.cos(a) * 45;
        const innerY = Math.sin(a) * 22;
        const outerX = Math.cos(a) * 101;
        const outerY = Math.sin(a) * 50;

        ctx.strokeStyle = '#6a5a48';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
    }

    // === Habitat Ring (middle ring, thicker - this is the Promenade level) ===
    // Fill the ring as a thick band
    ctx.strokeStyle = '#8a7a65';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 55, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner edge
    ctx.strokeStyle = '#6a5a48';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Outer edge
    ctx.strokeStyle = '#a09080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Promenade windows (warm lights along the habitat ring)
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + rot * 0.5;
        const lx = Math.cos(a) * 55;
        const ly = Math.sin(a) * 27;
        const blink = Math.sin(gameTime * 0.012 + i * 0.7) * 0.25 + 0.65;
        ctx.fillStyle = `rgba(255, 220, 140, ${blink})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // === Inner Weapon Sail / Shield Ring ===
    ctx.strokeStyle = '#7a6a55';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
    ctx.stroke();

    // === Central Core (Ops module at top) ===
    // Lower core section (reactor/power)
    const coreGrad = ctx.createRadialGradient(0, 3, 0, 0, 3, 22);
    coreGrad.addColorStop(0, '#a09080');
    coreGrad.addColorStop(0.5, '#7a6a58');
    coreGrad.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(0, 3, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a4a38';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Upper Ops tower (raised dome)
    const opsGrad = ctx.createRadialGradient(0, -4, 0, 0, -4, 14);
    opsGrad.addColorStop(0, '#c0a880');
    opsGrad.addColorStop(0.6, '#9a8060');
    opsGrad.addColorStop(1, '#6a5a40');
    ctx.fillStyle = opsGrad;
    ctx.beginPath();
    ctx.ellipse(0, -4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b09878';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Ops windows (the big viewports at the top of the station)
    const opsAlpha = 0.6 + Math.sin(gameTime * 0.025) * 0.15;
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + gameTime * 0.001;
        const wx = Math.cos(a) * 9;
        const wy = Math.sin(a) * 6 - 4;
        ctx.fillStyle = `rgba(255, 200, 100, ${opsAlpha})`;
        ctx.beginPath();
        ctx.arc(wx, wy, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Central Ops top light (the beacon)
    const beaconAlpha = 0.7 + Math.sin(gameTime * 0.05) * 0.3;
    ctx.fillStyle = `rgba(255, 180, 80, ${beaconAlpha})`;
    ctx.beginPath();
    ctx.arc(0, -6, 3, 0, Math.PI * 2);
    ctx.fill();
    // Beacon glow
    const beaconGlow = ctx.createRadialGradient(0, -6, 0, 0, -6, 12);
    beaconGlow.addColorStop(0, `rgba(255, 180, 80, ${beaconAlpha * 0.3})`);
    beaconGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = beaconGlow;
    ctx.beginPath();
    ctx.arc(0, -6, 12, 0, Math.PI * 2);
    ctx.fill();

    // === Station Label ===
    ctx.fillStyle = 'rgba(255, 170, 80, 0.5)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('DEEP SPACE 9', 0, 70);

    ctx.restore();
}

function drawDefiant(pos) {
    ctx.save();
    ctx.translate(pos.x, pos.y);

    const dir = defiant.angle;

    // Engine trail
    if (defiant.speed > 0.5) {
        defiant.engineTrail.push({
            x: defiant.x - Math.cos(dir) * 20,
            y: defiant.y - Math.sin(dir) * 20,
            life: 30,
            maxLife: 30
        });
    }

    // Shield bubble
    if (defiant.shieldsActive && defiant.shields > 0) {
        const shieldAlpha = 0.12 + Math.sin(gameTime * 0.1) * 0.05;
        const shieldGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 35);
        shieldGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
        shieldGrad.addColorStop(0.6, `rgba(100, 180, 255, ${shieldAlpha})`);
        shieldGrad.addColorStop(0.85, `rgba(80, 140, 255, ${shieldAlpha * 0.7})`);
        shieldGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 22, dir - Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Rotate to ship direction
    ctx.rotate(dir - Math.PI / 4);

    // === USS Defiant NX-74205 ===
    // Top-down view: compact arrowhead warship
    // Ref: flat triangular primary hull, stubby integrated nacelles, no neck

    // --- Main hull shadow/depth ---
    ctx.fillStyle = '#5a6570';
    ctx.beginPath();
    ctx.moveTo(24, 0);         // Nose tip
    ctx.lineTo(14, -5);
    ctx.lineTo(4, -9);
    ctx.lineTo(-8, -12);       // Port wing trailing edge
    ctx.lineTo(-16, -10);
    ctx.lineTo(-20, -6);       // Port aft
    ctx.lineTo(-20, 6);        // Starboard aft
    ctx.lineTo(-16, 10);
    ctx.lineTo(-8, 12);        // Starboard wing trailing edge
    ctx.lineTo(4, 9);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    // --- Main hull (lighter top surface) ---
    ctx.fillStyle = '#8a95a2';
    ctx.beginPath();
    ctx.moveTo(23, 0);         // Nose tip
    ctx.lineTo(14, -4.5);
    ctx.lineTo(5, -8.5);
    ctx.lineTo(-7, -11);
    ctx.lineTo(-15, -9.5);
    ctx.lineTo(-19, -5.5);
    ctx.lineTo(-19, 5.5);
    ctx.lineTo(-15, 9.5);
    ctx.lineTo(-7, 11);
    ctx.lineTo(5, 8.5);
    ctx.lineTo(14, 4.5);
    ctx.closePath();
    ctx.fill();

    // Hull panel lines
    ctx.strokeStyle = '#6a7580';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- Hull center ridge line ---
    ctx.strokeStyle = '#9aa5b0';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, 0);
    ctx.stroke();

    // --- Hull plating details (panel lines) ---
    ctx.strokeStyle = 'rgba(100, 115, 130, 0.5)';
    ctx.lineWidth = 0.4;
    // Port panel
    ctx.beginPath();
    ctx.moveTo(10, -3);
    ctx.lineTo(-10, -8);
    ctx.stroke();
    // Starboard panel
    ctx.beginPath();
    ctx.moveTo(10, 3);
    ctx.lineTo(-10, 8);
    ctx.stroke();
    // Cross panels
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.lineTo(-10, 9);
    ctx.stroke();

    // --- Deflector dish (front underside, blue-orange glow) ---
    const deflAlpha = 0.6 + Math.sin(gameTime * 0.06) * 0.2;
    ctx.fillStyle = `rgba(80, 160, 255, ${deflAlpha * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(18, 0, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(150, 200, 255, ${deflAlpha})`;
    ctx.beginPath();
    ctx.ellipse(18, 0, 2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Bridge module (raised section, slightly forward) ---
    ctx.fillStyle = '#a0aab5';
    ctx.beginPath();
    ctx.ellipse(6, 0, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a95a0';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Bridge windows (row of small lights)
    const winAlpha = 0.5 + Math.sin(gameTime * 0.04) * 0.2;
    ctx.fillStyle = `rgba(200, 230, 255, ${winAlpha})`;
    for (let i = -3; i <= 3; i++) {
        const wx = 6 + Math.cos(i * 0.35) * 5;
        const wy = Math.sin(i * 0.35) * 3;
        ctx.beginPath();
        ctx.arc(wx, wy, 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Warp Nacelles (compact, tucked into the hull) ---
    // Port nacelle (top in top-down view)
    ctx.fillStyle = '#6a7585';
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(-6, -12.5);
    ctx.lineTo(-19, -11);
    ctx.lineTo(-19, -7.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a6570';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Starboard nacelle
    ctx.fillStyle = '#6a7585';
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(-6, 12.5);
    ctx.lineTo(-19, 11);
    ctx.lineTo(-19, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a6570';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- Nacelle Bussard Collectors (front of nacelles, reddish glow) ---
    const bussardAlpha = 0.5 + Math.sin(gameTime * 0.08) * 0.3;
    ctx.fillStyle = `rgba(255, 80, 50, ${bussardAlpha})`;
    ctx.beginPath();
    ctx.ellipse(-6, -10.8, 1.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 80, 50, ${bussardAlpha})`;
    ctx.beginPath();
    ctx.ellipse(-6, 10.8, 1.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Warp field grilles (blue glow strips along nacelles) ---
    const warpGlow = defiant.speed > 0.5 ? 0.8 : 0.3;
    ctx.strokeStyle = `rgba(100, 170, 255, ${warpGlow})`;
    ctx.lineWidth = 1.5;
    // Port
    ctx.beginPath();
    ctx.moveTo(-8, -11.8);
    ctx.lineTo(-18, -10.5);
    ctx.stroke();
    // Starboard
    ctx.beginPath();
    ctx.moveTo(-8, 11.8);
    ctx.lineTo(-18, 10.5);
    ctx.stroke();
    // Glow effect
    ctx.strokeStyle = `rgba(100, 170, 255, ${warpGlow * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, -11.8);
    ctx.lineTo(-18, -10.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 11.8);
    ctx.lineTo(-18, 10.5);
    ctx.stroke();

    // --- Impulse engines (aft, reddish-orange glow when moving) ---
    if (defiant.speed > 0.3) {
        const turbo = keys['ShiftLeft'] || keys['ShiftRight'] || touch.turbo;
        const impulseAlpha = turbo ? 0.9 : 0.6;
        const impulseSize = turbo ? 14 : 9;
        // Main impulse
        const impGrad = ctx.createRadialGradient(-20, 0, 0, -20, 0, impulseSize);
        impGrad.addColorStop(0, `rgba(255, 180, 80, ${impulseAlpha})`);
        impGrad.addColorStop(0.4, `rgba(255, 120, 40, ${impulseAlpha * 0.6})`);
        impGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = impGrad;
        ctx.beginPath();
        ctx.arc(-20, 0, impulseSize, 0, Math.PI * 2);
        ctx.fill();
        // Impulse vents (two on each side of aft)
        ctx.fillStyle = `rgba(255, 140, 60, ${impulseAlpha * 0.7})`;
        ctx.fillRect(-20, -5, 2, 3);
        ctx.fillRect(-20, 2, 2, 3);
    }

    // Aft impulse housing (always visible)
    ctx.fillStyle = '#70808e';
    ctx.fillRect(-20, -5.5, 3, 11);

    // --- Running lights ---
    // Port (red)
    const rlBlink = Math.sin(gameTime * 0.06) > 0 ? 0.9 : 0.2;
    ctx.fillStyle = `rgba(255, 40, 40, ${rlBlink})`;
    ctx.beginPath();
    ctx.arc(-7, -12, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Starboard (green)
    ctx.fillStyle = `rgba(40, 255, 40, ${rlBlink})`;
    ctx.beginPath();
    ctx.arc(-7, 12, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Registry number ---
    ctx.rotate(-(dir - Math.PI / 4));
    ctx.fillStyle = 'rgba(150, 200, 255, 0.45)';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('NX-74205', 0, 28);

    ctx.restore();
}

function drawEnemy(enemy) {
    const pos = worldToScreen(enemy.x, enemy.y);
    if (pos.x < -60 || pos.x > canvas.width + 60 || pos.y < -60 || pos.y > canvas.height + 60) return;

    const type = ENEMY_TYPES[enemy.type];
    const s = type.size;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(enemy.angle - Math.PI / 4);

    if (enemy.type === 'jemhadar') {
        // === Jem'Hadar Attack Ship ===
        // Beetle/scarab shaped: wide curved front, tapered back, organic look
        // Dark purple hull with violet accents

        // Wing shadow
        ctx.fillStyle = '#2a1045';
        ctx.beginPath();
        ctx.moveTo(s * 0.9, 0);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.9, -s * 0.3, -s * 0.8);
        ctx.lineTo(-s, -s * 0.35);
        ctx.lineTo(-s * 1.1, 0);
        ctx.lineTo(-s, s * 0.35);
        ctx.lineTo(-s * 0.3, s * 0.8);
        ctx.quadraticCurveTo(s * 0.5, s * 0.9, s * 0.9, 0);
        ctx.closePath();
        ctx.fill();

        // Main hull
        ctx.fillStyle = '#4a2075';
        ctx.beginPath();
        ctx.moveTo(s * 0.85, 0);
        ctx.quadraticCurveTo(s * 0.45, -s * 0.75, -s * 0.25, -s * 0.7);
        ctx.lineTo(-s * 0.9, -s * 0.3);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.9, s * 0.3);
        ctx.lineTo(-s * 0.25, s * 0.7);
        ctx.quadraticCurveTo(s * 0.45, s * 0.75, s * 0.85, 0);
        ctx.closePath();
        ctx.fill();

        // Hull ridge (center spine)
        ctx.strokeStyle = '#6a3aaa';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(s * 0.7, 0);
        ctx.lineTo(-s * 0.8, 0);
        ctx.stroke();

        // Wing veins (organic look)
        ctx.strokeStyle = 'rgba(120, 60, 180, 0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.15);
        ctx.quadraticCurveTo(0, -s * 0.5, -s * 0.5, -s * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.3, s * 0.15);
        ctx.quadraticCurveTo(0, s * 0.5, -s * 0.5, s * 0.55);
        ctx.stroke();

        // Cockpit (forward)
        ctx.fillStyle = '#7a45c0';
        ctx.beginPath();
        ctx.ellipse(s * 0.4, 0, s * 0.25, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Engine glow (aft, purple)
        const engAlpha = 0.5 + Math.sin(gameTime * 0.08) * 0.2;
        const engGrad = ctx.createRadialGradient(-s, 0, 0, -s, 0, s * 0.5);
        engGrad.addColorStop(0, `rgba(160, 80, 255, ${engAlpha})`);
        engGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = engGrad;
        ctx.beginPath();
        ctx.arc(-s, 0, s * 0.5, 0, Math.PI * 2);
        ctx.fill();

    } else if (enemy.type === 'cardassian') {
        // === Cardassian Galor Class ===
        // Long forward "neck" weapon array, wide aft hull with angled wings
        // Yellow-brown metallic color

        // Aft hull (wider section)
        ctx.fillStyle = '#6a5520';
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.3);
        ctx.lineTo(-s * 0.6, -s * 0.9);  // Port wing
        ctx.lineTo(-s * 1.1, -s * 0.5);
        ctx.lineTo(-s * 1.1, s * 0.5);
        ctx.lineTo(-s * 0.6, s * 0.9);    // Starboard wing
        ctx.lineTo(-s * 0.1, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8a7530';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Main hull top
        ctx.fillStyle = '#8a7530';
        ctx.beginPath();
        ctx.moveTo(-s * 0.15, -s * 0.25);
        ctx.lineTo(-s * 0.55, -s * 0.75);
        ctx.lineTo(-s, -s * 0.45);
        ctx.lineTo(-s, s * 0.45);
        ctx.lineTo(-s * 0.55, s * 0.75);
        ctx.lineTo(-s * 0.15, s * 0.25);
        ctx.closePath();
        ctx.fill();

        // Forward weapon array / neck (long narrow section)
        ctx.fillStyle = '#7a6528';
        ctx.beginPath();
        ctx.moveTo(s * 1.3, 0);            // Tip of weapon array
        ctx.lineTo(s * 0.5, -s * 0.12);
        ctx.lineTo(-s * 0.1, -s * 0.2);
        ctx.lineTo(-s * 0.1, s * 0.2);
        ctx.lineTo(s * 0.5, s * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#9a8540';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Weapon tip glow
        const wpnAlpha = 0.5 + Math.sin(gameTime * 0.07) * 0.25;
        ctx.fillStyle = `rgba(255, 200, 50, ${wpnAlpha})`;
        ctx.beginPath();
        ctx.arc(s * 1.3, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Central raised section
        ctx.fillStyle = '#a09040';
        ctx.beginPath();
        ctx.ellipse(-s * 0.4, 0, s * 0.35, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bridge windows
        ctx.fillStyle = `rgba(255, 220, 100, 0.5)`;
        ctx.beginPath();
        ctx.ellipse(-s * 0.4, 0, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();

        // Engine glow
        const cEngAlpha = 0.4 + Math.sin(gameTime * 0.06) * 0.2;
        ctx.fillStyle = `rgba(255, 180, 50, ${cEngAlpha})`;
        ctx.beginPath();
        ctx.arc(-s * 1.1, -s * 0.2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 1.1, s * 0.2, 3, 0, Math.PI * 2);
        ctx.fill();

    } else if (enemy.type === 'breen') {
        // === Breen Warship ===
        // Asymmetric, angular, aggressive - forward crescent shape
        // Teal/cyan coloring, icy appearance

        // Main hull (crescent shape)
        ctx.fillStyle = '#1a5555';
        ctx.beginPath();
        ctx.moveTo(s * 0.9, 0);
        ctx.lineTo(s * 0.3, -s * 0.6);
        ctx.lineTo(-s * 0.2, -s * 0.9);    // Port crescent tip
        ctx.lineTo(-s * 0.5, -s * 0.7);
        ctx.lineTo(-s * 0.7, -s * 0.3);
        ctx.lineTo(-s * 0.8, 0);
        ctx.lineTo(-s * 0.7, s * 0.3);
        ctx.lineTo(-s * 0.5, s * 0.7);
        ctx.lineTo(-s * 0.2, s * 0.9);      // Starboard crescent tip
        ctx.lineTo(s * 0.3, s * 0.6);
        ctx.closePath();
        ctx.fill();

        // Top surface
        ctx.fillStyle = '#2a7575';
        ctx.beginPath();
        ctx.moveTo(s * 0.8, 0);
        ctx.lineTo(s * 0.25, -s * 0.5);
        ctx.lineTo(-s * 0.15, -s * 0.78);
        ctx.lineTo(-s * 0.45, -s * 0.6);
        ctx.lineTo(-s * 0.6, -s * 0.25);
        ctx.lineTo(-s * 0.7, 0);
        ctx.lineTo(-s * 0.6, s * 0.25);
        ctx.lineTo(-s * 0.45, s * 0.6);
        ctx.lineTo(-s * 0.15, s * 0.78);
        ctx.lineTo(s * 0.25, s * 0.5);
        ctx.closePath();
        ctx.fill();

        // Center structure
        ctx.fillStyle = '#3a9090';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.35, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hull lines (icy cracks)
        ctx.strokeStyle = 'rgba(100, 220, 220, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.15);
        ctx.lineTo(-s * 0.3, -s * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.5, s * 0.15);
        ctx.lineTo(-s * 0.3, s * 0.65);
        ctx.stroke();

        // Energy weapon glow (crescent tips)
        const breenAlpha = 0.4 + Math.sin(gameTime * 0.09) * 0.3;
        ctx.fillStyle = `rgba(100, 255, 255, ${breenAlpha})`;
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.85, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.2, s * 0.85, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Engine
        const bEngGrad = ctx.createRadialGradient(-s * 0.8, 0, 0, -s * 0.8, 0, s * 0.3);
        bEngGrad.addColorStop(0, `rgba(100, 255, 255, 0.5)`);
        bEngGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bEngGrad;
        ctx.beginPath();
        ctx.arc(-s * 0.8, 0, s * 0.3, 0, Math.PI * 2);
        ctx.fill();

    } else if (enemy.type === 'borg') {
        // === Borg Cube ===
        // Perfect cube viewed at angle, with green glow, mechanical surface
        // Much larger and more menacing

        // Cube shadow/depth
        ctx.fillStyle = '#0a2a0a';
        ctx.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1);

        // Main cube face
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s);

        // Mechanical grid pattern
        ctx.strokeStyle = 'rgba(0, 200, 0, 0.25)';
        ctx.lineWidth = 0.3;
        const gridStep = s / 6;
        for (let i = -s * 0.5; i <= s * 0.5; i += gridStep) {
            ctx.beginPath();
            ctx.moveTo(i, -s * 0.5);
            ctx.lineTo(i, s * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, i);
            ctx.lineTo(s * 0.5, i);
            ctx.stroke();
        }

        // Random machinery lights
        for (let gx = 0; gx < 5; gx++) {
            for (let gy = 0; gy < 5; gy++) {
                const seed = (gx * 7 + gy * 13 + Math.floor(gameTime * 0.02)) % 5;
                if (seed < 2) {
                    const lx = -s * 0.4 + gx * gridStep;
                    const ly = -s * 0.4 + gy * gridStep;
                    const flicker = Math.sin(gameTime * 0.03 + gx * 2 + gy * 3) * 0.3 + 0.5;
                    ctx.fillStyle = `rgba(0, 255, 0, ${flicker * 0.6})`;
                    ctx.fillRect(lx, ly, gridStep * 0.5, gridStep * 0.5);
                }
            }
        }

        // Outer frame
        ctx.strokeStyle = '#00cc00';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);

        // 3D edge effect (cube depth illusion)
        ctx.strokeStyle = 'rgba(0, 180, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.5);
        ctx.lineTo(-s * 0.6, -s * 0.6);
        ctx.moveTo(s * 0.5, -s * 0.5);
        ctx.lineTo(s * 0.6, -s * 0.6);
        ctx.moveTo(s * 0.5, s * 0.5);
        ctx.lineTo(s * 0.6, s * 0.6);
        ctx.moveTo(-s * 0.5, s * 0.5);
        ctx.lineTo(-s * 0.6, s * 0.6);
        ctx.stroke();

        // Green ambient glow
        const borgGlow = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 0.9);
        borgGlow.addColorStop(0, 'rgba(0, 255, 0, 0.08)');
        borgGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = borgGlow;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Central green eye
        const eyeAlpha = 0.5 + Math.sin(gameTime * 0.05) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 80, ${eyeAlpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Health bar
    if (enemy.hull < ENEMY_TYPES[enemy.type].hull) {
        const hpPct = enemy.hull / ENEMY_TYPES[enemy.type].hull;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(pos.x - 15, pos.y - type.size - 10, 30, 3);
        ctx.fillStyle = hpPct > 0.5 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 100, 0, 0.7)';
        ctx.fillRect(pos.x - 15, pos.y - type.size - 10, 30 * hpPct, 3);
    }

    // Name tag
    ctx.fillStyle = type.color + '88';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(type.name, pos.x, pos.y + type.size + 14);
}

function drawWormhole() {
    const pos = worldToScreen(wormhole.x, wormhole.y);
    if (pos.x < -150 || pos.x > canvas.width + 150 || pos.y < -150 || pos.y > canvas.height + 150) return;

    wormhole.pulsePhase += 0.02;
    const t = wormhole.pulsePhase;
    const R = wormhole.radius;

    // Outer ambient glow (large, soft)
    const ambGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, R * 2);
    ambGrad.addColorStop(0, `rgba(120, 160, 255, ${0.08 + Math.sin(t) * 0.03})`);
    ambGrad.addColorStop(0.5, `rgba(80, 120, 220, 0.04)`);
    ambGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R * 2, 0, Math.PI * 2);
    ctx.fill();

    // Swirling energy rings (the wormhole spiral arms)
    for (let arm = 0; arm < 4; arm++) {
        const armAngle = (arm / 4) * Math.PI * 2 + t * 0.8;
        ctx.strokeStyle = `hsla(${210 + arm * 15}, 80%, 70%, ${0.15 + Math.sin(t + arm) * 0.05})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let p = 0; p < 40; p++) {
            const pct = p / 40;
            const spiralR = R * 0.1 + pct * R * 0.95;
            const spiralAngle = armAngle + pct * Math.PI * 2.5;
            const sx = pos.x + Math.cos(spiralAngle) * spiralR;
            const sy = pos.y + Math.sin(spiralAngle) * spiralR * 0.5;
            if (p === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }

    // Concentric distortion rings
    for (let ring = 0; ring < 6; ring++) {
        const r = R * 0.15 + ring * R * 0.15 + Math.sin(t * 1.5 + ring * 0.8) * 4;
        const alpha = 0.2 - ring * 0.025;
        const hue = 200 + ring * 10 + Math.sin(t + ring) * 15;
        ctx.strokeStyle = `hsla(${hue}, 75%, 65%, ${alpha})`;
        ctx.lineWidth = 2 - ring * 0.2;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, r, r * 0.5,
            Math.sin(t * 0.3 + ring * 0.5) * 0.15, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Inner bright vortex
    const innerGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, R * 0.4);
    const coreAlpha = 0.5 + Math.sin(t * 1.2) * 0.2;
    innerGrad.addColorStop(0, `rgba(220, 235, 255, ${coreAlpha})`);
    innerGrad.addColorStop(0.4, `rgba(150, 190, 255, ${coreAlpha * 0.5})`);
    innerGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, R * 0.4, R * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // White-hot center
    const centerAlpha = 0.7 + Math.sin(t * 2) * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${centerAlpha})`;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('TROU DE VER BAJORAN', pos.x, pos.y + R + 20);
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
