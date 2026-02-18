const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---
const TILE_SIZE = 32;
const WORLD_WIDTH = 200;
const WORLD_HEIGHT = 80;
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const SPEED = 4;

// --- Tile types ---
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, DEEPSLATE = 4;
const GOLD_ORE = 5, DIAMOND_ORE = 6, TRUNK = 7, LEAVES = 8, SAND = 9;

const COLORS = {
    [AIR]: 'transparent',
    [GRASS]: '#228B22',
    [DIRT]: '#8B4513',
    [STONE]: '#808080',
    [DEEPSLATE]: '#444444',
    [GOLD_ORE]: '#FFD700',
    [DIAMOND_ORE]: '#00CED1',
    [TRUNK]: '#556B2F',
    [LEAVES]: '#2E8B57',
    [SAND]: '#C19A6B'
};

// --- Robust hash-based PRNG ---
function hashU32(a) {
    a = (a ^ 61) ^ (a >>> 16);
    a = (a + (a << 3)) | 0;
    a = a ^ (a >>> 4);
    a = Math.imul(a, 0x27d4eb2d);
    a = a ^ (a >>> 15);
    return a >>> 0;
}
function hash2D(x, y) { return hashU32(hashU32(x) ^ (y * 0x45d9f3b)); }
function rand1(ix, seed) { return hashU32(ix + seed) / 4294967296; }
function rand2(ix, iy, seed) { return hash2D(ix + seed, iy + seed * 17) / 4294967296; }
function smoothstep(t) { return t * t * (3 - 2 * t); }

function noise1D(x, seed) {
    const ix = Math.floor(x), fx = x - ix;
    return rand1(ix, seed) + (rand1(ix + 1, seed) - rand1(ix, seed)) * smoothstep(fx);
}
function noise2D(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
    const a = rand2(ix, iy, seed), b = rand2(ix+1, iy, seed);
    const c = rand2(ix, iy+1, seed), d = rand2(ix+1, iy+1, seed);
    return (a + (b-a)*fx) + ((c + (d-c)*fx) - (a + (b-a)*fx)) * fy;
}
function fbm1D(x, octaves, seed) {
    let val = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        val += noise1D(x * freq, seed + i * 1000) * amp;
        maxAmp += amp; amp *= 0.5; freq *= 2;
    }
    return val / maxAmp;
}
function fbm2D(x, y, octaves, seed) {
    let val = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        val += noise2D(x * freq, y * freq, seed + i * 1000) * amp;
        maxAmp += amp; amp *= 0.5; freq *= 2;
    }
    return val / maxAmp;
}

// --- Game State ---
const world = [];
const camera = { x: 0, y: 0 };
const player = { x: 0, y: 0, w: 24, h: 48, vx: 0, vy: 0, grounded: false };
const keys = {};
const inventory = {};
let selectedSlot = GRASS;

// --- World Generation ---
function generateWorld() {
    const seed = (Math.random() * 2147483647) | 0;
    const SURFACE_BASE = 20, SURFACE_AMP = 15, DIRT_DEPTH = 5, DEEPSLATE_Y = 60;
    const surfaceHeights = [];

    for (let x = 0; x < WORLD_WIDTH; x++) {
        surfaceHeights[x] = Math.floor(SURFACE_BASE + fbm1D(x * 0.04, 5, seed) * SURFACE_AMP);
    }
    for (let x = 0; x < WORLD_WIDTH; x++) {
        world[x] = new Array(WORLD_HEIGHT);
        const sy = surfaceHeights[x];
        const heightNoise = fbm1D(x * 0.04, 5, seed);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            let type = AIR;
            if      (y < sy)          type = AIR;
            else if (y === sy)        type = heightNoise < 0.35 ? SAND : GRASS;
            else if (y <= sy+DIRT_DEPTH) type = DIRT;
            else if (y < DEEPSLATE_Y) type = STONE;
            else                      type = DEEPSLATE;

            if (y > sy + 3 && type !== AIR) {
                if (fbm2D(x * 0.07, y * 0.07, 4, seed + 5000) > 0.58) type = AIR;
            }
            if (type === STONE || type === DEEPSLATE) {
                if (fbm2D(x * 0.15, y * 0.15, 2, seed + 10000) > 0.73) type = GOLD_ORE;
                if (y > 50 && fbm2D(x * 0.2, y * 0.2, 2, seed + 20000) > 0.78) type = DIAMOND_ORE;
            }
            world[x][y] = type;
        }
    }

    for (let x = 3; x < WORLD_WIDTH - 3; x++) {
        const sy = surfaceHeights[x];
        if (world[x][sy] !== GRASS) continue;
        if (rand1(x * 7 + 13, seed) < 0.85) continue;
        const trunkH = 4 + Math.floor(rand1(x * 3 + 77, seed) * 3);
        for (let t = 1; t <= trunkH; t++) {
            if (sy - t >= 0) world[x][sy - t] = TRUNK;
        }
        const leafTop = sy - trunkH;
        for (let lx = -2; lx <= 2; lx++) {
            for (let ly = -2; ly <= 1; ly++) {
                if (Math.abs(lx) === 2 && Math.abs(ly) === 2) continue;
                const wx = x + lx, wy = leafTop + ly;
                if (wx >= 0 && wx < WORLD_WIDTH && wy >= 0 && wy < WORLD_HEIGHT) {
                    if (world[wx][wy] === AIR) world[wx][wy] = LEAVES;
                }
            }
        }
    }

    const spawnX = Math.floor(WORLD_WIDTH / 2);
    player.x = spawnX * TILE_SIZE;
    player.y = (surfaceHeights[spawnX] - 3) * TILE_SIZE;
}

// --- Initialization ---
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    generateWorld();
    [GRASS, DIRT, STONE, DEEPSLATE, GOLD_ORE, DIAMOND_ORE, TRUNK, SAND].forEach(type => {
        inventory[type] = 0;
    });
    requestAnimationFrame(update);
}

// --- Input ---
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    const slotKeys  = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8'];
    const slotTypes = [GRASS, DIRT, STONE, DEEPSLATE, GOLD_ORE, DIAMOND_ORE, TRUNK, SAND];
    const idx = slotKeys.indexOf(e.code);
    if (idx !== -1) selectedSlot = slotTypes[idx];
});
window.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const tileX = Math.floor((e.clientX - rect.left  + camera.x) / TILE_SIZE);
    const tileY = Math.floor((e.clientY - rect.top   + camera.y) / TILE_SIZE);
    if (tileX < 0 || tileX >= WORLD_WIDTH || tileY < 0 || tileY >= WORLD_HEIGHT) return;
    if (e.button === 0) {
        const tile = world[tileX][tileY];
        if (tile !== AIR && tile !== LEAVES) {
            inventory[tile] = (inventory[tile] || 0) + 1;
            world[tileX][tileY] = AIR;
        } else if (tile === LEAVES) {
            world[tileX][tileY] = AIR;
        }
    }
    if (e.button === 2 && world[tileX][tileY] === AIR && inventory[selectedSlot] > 0) {
        world[tileX][tileY] = selectedSlot;
        inventory[selectedSlot]--;
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- Core Logic ---
function update() {
    player.vx = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -SPEED;
    if (keys['ArrowRight']|| keys['KeyD']) player.vx =  SPEED;
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.grounded) {
        player.vy = JUMP_FORCE; player.grounded = false;
    }
    player.vy += GRAVITY;
    player.grounded = false;
    player.y += player.vy; resolveCollision('y');
    player.x += player.vx;
    player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH * TILE_SIZE - player.w));
    resolveCollision('x');
    if (player.y + player.h > WORLD_HEIGHT * TILE_SIZE) {
        player.y = WORLD_HEIGHT * TILE_SIZE - player.h; player.vy = 0; player.grounded = true;
    }
    camera.x = Math.max(0, Math.min(player.x - canvas.width/2  + player.w/2, WORLD_WIDTH  * TILE_SIZE - canvas.width));
    camera.y = Math.max(0, Math.min(player.y - canvas.height/2 + player.h/2, WORLD_HEIGHT * TILE_SIZE - canvas.height));
    draw();
    requestAnimationFrame(update);
}

function resolveCollision(axis) {
    const skin = 2;
    if (axis === 'y') {
        const left = Math.floor((player.x + skin) / TILE_SIZE);
        const right = Math.floor((player.x + player.w - skin) / TILE_SIZE);
        const top = Math.floor(player.y / TILE_SIZE);
        const bot = Math.floor((player.y + player.h) / TILE_SIZE);
        for (let x = left; x <= right; x++) for (let y = top; y <= bot; y++) {
            if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
            if (world[x][y] > 0) {
                if (player.vy > 0) { player.y = y * TILE_SIZE - player.h; player.vy = 0; player.grounded = true; }
                else if (player.vy < 0) { player.y = (y + 1) * TILE_SIZE; player.vy = 0; }
            }
        }
    } else {
        const left = Math.floor(player.x / TILE_SIZE);
        const right = Math.floor((player.x + player.w) / TILE_SIZE);
        const top = Math.floor((player.y + skin) / TILE_SIZE);
        const bot = Math.floor((player.y + player.h - skin) / TILE_SIZE);
        for (let x = left; x <= right; x++) for (let y = top; y <= bot; y++) {
            if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
            if (world[x][y] > 0) {
                if (player.vx > 0) player.x = x * TILE_SIZE - player.w;
                if (player.vx < 0) player.x = (x + 1) * TILE_SIZE;
            }
        }
    }
}

// --- Rendering ---
const TILE_NAMES = {
    [GRASS]: 'Grass', [DIRT]: 'Dirt', [STONE]: 'Stone', [DEEPSLATE]: 'Deepslate',
    [GOLD_ORE]: 'Gold', [DIAMOND_ORE]: 'Diamond', [TRUNK]: 'Wood', [SAND]: 'Sand'
};

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#4A90D9'); grad.addColorStop(1, '#87CEEB');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const ex = Math.min(WORLD_WIDTH,  Math.ceil((camera.x + canvas.width)  / TILE_SIZE) + 1);
    const sy = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const ey = Math.min(WORLD_HEIGHT, Math.ceil((camera.y + canvas.height) / TILE_SIZE) + 1);

    for (let x = sx; x < ex; x++) for (let y = sy; y < ey; y++) {
        const tile = world[x][y];
        if (tile !== AIR) {
            const dx = x * TILE_SIZE - camera.x, dy = y * TILE_SIZE - camera.y;
            ctx.fillStyle = COLORS[tile]; ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.strokeRect(dx, dy, TILE_SIZE, TILE_SIZE);
        }
    }

    ctx.fillStyle = '#FF6347';
    ctx.fillRect(player.x - camera.x, player.y - camera.y, player.w, player.h);
    drawInventory();
}

function drawInventory() {
    const slotTypes = [GRASS, DIRT, STONE, DEEPSLATE, GOLD_ORE, DIAMOND_ORE, TRUNK, SAND];
    const margin = 10, size = 50;
    const startX = canvas.width / 2 - (slotTypes.length * (size + margin)) / 2;
    const y = canvas.height - size - 20;

    slotTypes.forEach((type, i) => {
        const x = startX + i * (size + margin);
        ctx.fillStyle   = (selectedSlot === type) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        ctx.strokeStyle = (selectedSlot === type) ? 'white' : 'black';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, size, size); ctx.strokeRect(x, y, size, size);
        ctx.fillStyle = COLORS[type]; ctx.fillRect(x+10, y+10, size-20, size-20);
        ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right';
        ctx.fillText(inventory[type], x + size - 5, y + size - 5);
        ctx.textAlign = 'left'; ctx.font = '10px Arial';
        ctx.fillText(i + 1, x + 5, y + 12);
    });
}

init();
