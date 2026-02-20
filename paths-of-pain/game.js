const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const timerEl = document.getElementById("timer");

const TILE_SIZE = 40;
const VIEWPORT_WIDTH = window.innerWidth;
const VIEWPORT_HEIGHT = window.innerHeight;

canvas.width = VIEWPORT_WIDTH;
canvas.height = VIEWPORT_HEIGHT;
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '-1';

const MAZE_COLS = 50;
const MAZE_ROWS = 50;
const SPIKE_SIZE = 12;
const TOTAL_WIDTH  = MAZE_COLS * TILE_SIZE;
const TOTAL_HEIGHT = MAZE_ROWS * TILE_SIZE;

let startTime;
let gameInterval;
let isPlaying = false;
let map = [];
let enemies = [];
let player = { x: 0, y: 0, vx: 0, vy: 0, speed: 5, size: 20, isHiding: false };
let camera = { x: 0, y: 0 };
let trail = [];
let frameCounter = 0;
let justDied = false;
const TRAIL_MAX_AGE = 8000; // Trail points disappear after 8 seconds
const TRAIL_SAMPLE_RATE = 3; // Record every 3rd frame to avoid too many points

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function generateMaze() {
    map = [];
    for (let r = 0; r < MAZE_ROWS; r++) {
        let row = [];
        for (let c = 0; c < MAZE_COLS; c++) row.push(1);
        map.push(row);
    }

    const stack = [];
    map[1][1] = 0;
    stack.push({ x: 1, y: 1 });
    const directions = [[0, 2], [0, -2], [2, 0], [-2, 0]];

    while (stack.length > 0) {
        const { x, y } = stack[stack.length - 1];
        const neighbors = [];
        for (let d of directions) {
            const nx = x + d[0], ny = y + d[1];
            if (nx > 0 && nx < MAZE_COLS - 1 && ny > 0 && ny < MAZE_ROWS - 1 && map[ny][nx] === 1) {
                neighbors.push({ nx, ny, dx: d[0] / 2, dy: d[1] / 2 });
            }
        }
        if (neighbors.length > 0) {
            const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
            map[y + chosen.dy][x + chosen.dx] = 0;
            map[chosen.ny][chosen.nx] = 0;
            stack.push({ x: chosen.nx, y: chosen.ny });
        } else {
            stack.pop();
        }
    }

    map[1][1] = 4;
    player.x = 1 * TILE_SIZE + TILE_SIZE / 2;
    player.y = 1 * TILE_SIZE + TILE_SIZE / 2;
    trail = [];

    let endX = MAZE_COLS - 2, endY = MAZE_ROWS - 2;
    while (map[endY][endX] === 1) {
        endX--;
        if (endX < 1) { endX = MAZE_COLS - 2; endY--; }
    }
    map[endY][endX] = 3;

    for (let r = 1; r < MAZE_ROWS - 1; r++) {
        for (let c = 1; c < MAZE_COLS - 1; c++) {
            if (map[r][c] === 0 && Math.random() < 0.1) {
                if (Math.abs(r - 1) + Math.abs(c - 1) > 2 && Math.abs(r - endY) + Math.abs(c - endX) > 2) {
                    map[r][c] = 2;
                }
            }
        }
    }

    enemies = [];
    let attempts = 0;
    while (enemies.length < 30 && attempts < 500) {
        attempts++;
        let r = Math.floor(Math.random() * (MAZE_ROWS - 2)) + 1;
        let c = Math.floor(Math.random() * (MAZE_COLS - 2)) + 1;
        if (map[r][c] === 0 && Math.abs(r - 1) + Math.abs(c - 1) > 5) {
            const canGoHorizontal = (map[r][c - 1] === 0 || map[r][c + 1] === 0);
            const canGoVertical   = (map[r - 1][c] === 0 || map[r + 1][c] === 0);
            if (canGoHorizontal || canGoVertical) {
                let horizontal = canGoHorizontal;
                if (canGoHorizontal && canGoVertical) horizontal = Math.random() > 0.5;
                enemies.push({
                    x: c * TILE_SIZE + TILE_SIZE / 2,
                    y: r * TILE_SIZE + TILE_SIZE / 2,
                    vx: horizontal ? 2 : 0,
                    vy: horizontal ? 0 : 2,
                    size: 25,
                    angle: 0,
                    rotationSpeed: 0.05 + Math.random() * 0.1
                });
            }
        }
    }
}

function loadLevel() {
    generateMaze();
    // Seed trail with starting position so there's always a respawn point
    trail = [{ x: player.x, y: player.y, time: Date.now() }];
    resetTimer();
}

function resetTimer() {
    startTime = Date.now();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        timerEl.innerText = ((Date.now() - startTime) / 1000).toFixed(2);
    }, 50);
}

const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (!isPlaying && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
        isPlaying = true;
        resetTimer();
    }
});
document.addEventListener('keyup', e => keys[e.code] = false);

function update() {
    if (winState) return; // freeze game during win screen
    justDied = false;
    player.isHiding = !!keys['ShiftLeft'];
    const currentSpeed = player.isHiding ? player.speed * 0.5 : player.speed;

    if (keys['ArrowUp']   || keys['KeyW']) player.vy = -currentSpeed;
    else if (keys['ArrowDown']  || keys['KeyS']) player.vy =  currentSpeed;
    else player.vy = 0;

    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -currentSpeed;
    else if (keys['ArrowRight'] || keys['KeyD']) player.vx =  currentSpeed;
    else player.vx = 0;

    movePlayer(player.vx, 0);
    movePlayer(0, player.vy);
    
    // Record trail position every TRAIL_SAMPLE_RATE frames
    frameCounter++;
    if (frameCounter >= TRAIL_SAMPLE_RATE) {
        trail.push({ x: player.x, y: player.y, time: Date.now() });
        frameCounter = 0;
    }
    
    // Remove expired trail points, but always keep the most recent as a respawn anchor
    const now = Date.now();
    const filtered = trail.filter(point => (now - point.time) < TRAIL_MAX_AGE);
    trail = filtered.length > 0 ? filtered : trail.slice(-1);
    
    checkHazards();
    checkWin();

    const targetCamX = player.x - canvas.width / 2;
    const targetCamY = player.y - canvas.height / 2;
    camera.x = lerp(camera.x, targetCamX, 0.1);
    camera.y = lerp(camera.y, targetCamY, 0.1);
    camera.x = Math.max(0, Math.min(camera.x, TOTAL_WIDTH  - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, TOTAL_HEIGHT - canvas.height));

    enemies.forEach(enemy => {
        enemy.angle += enemy.rotationSpeed;
        const nextX = enemy.x + enemy.vx;
        const nextY = enemy.y + enemy.vy;
        const margin = enemy.size / 2;
        const lc = Math.floor((nextX - margin) / TILE_SIZE);
        const rc = Math.floor((nextX + margin) / TILE_SIZE);
        const tr = Math.floor((nextY - margin) / TILE_SIZE);
        const br = Math.floor((nextY + margin) / TILE_SIZE);
        if (isSolid(lc, tr) || isSolid(rc, tr) || isSolid(lc, br) || isSolid(rc, br)) {
            enemy.vx *= -1; enemy.vy *= -1;
        } else {
            enemy.x = nextX; enemy.y = nextY;
        }
        const dx = player.x - enemy.x, dy = player.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < (player.size / 2 + enemy.size / 2) && !player.isHiding) {
            die();
        }
    });
}

function movePlayer(vx, vy) {
    const nextX = player.x + vx, nextY = player.y + vy;
    const margin = player.size / 2;
    const lc = Math.floor((nextX - margin) / TILE_SIZE);
    const rc = Math.floor((nextX + margin) / TILE_SIZE);
    const tr = Math.floor((nextY - margin) / TILE_SIZE);
    const br = Math.floor((nextY + margin) / TILE_SIZE);
    if (!isSolid(lc, tr) && !isSolid(rc, tr) && !isSolid(lc, br) && !isSolid(rc, br)) {
        player.x = nextX; player.y = nextY;
    }
}

function isSolid(c, r) {
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS) return true;
    return map[r][c] === 1;
}

function checkHazards() {
    if (player.isHiding) return;
    const margin = player.size / 3;
    const corners = [
        { x: player.x - margin, y: player.y - margin },
        { x: player.x + margin, y: player.y - margin },
        { x: player.x - margin, y: player.y + margin },
        { x: player.x + margin, y: player.y + margin }
    ];
    for (let p of corners) {
        const c = Math.floor(p.x / TILE_SIZE), r = Math.floor(p.y / TILE_SIZE);
        if (r >= 0 && r < MAZE_ROWS && c >= 0 && c < MAZE_COLS && map[r][c] === 2) {
            const dir = getSpikeDirection(r, c);
            const tx = p.x % TILE_SIZE, ty = p.y % TILE_SIZE;
            if (dir === 'top'    && ty < SPIKE_SIZE)              { die(); return; }
            if (dir === 'bottom' && ty > TILE_SIZE - SPIKE_SIZE)  { die(); return; }
            if (dir === 'left'   && tx < SPIKE_SIZE)              { die(); return; }
            if (dir === 'right'  && tx > TILE_SIZE - SPIKE_SIZE)  { die(); return; }
        }
    }
}

function getSpikeDirection(r, c) {
    if (r > 0            && map[r - 1][c] === 1) return 'top';
    if (r < MAZE_ROWS-1  && map[r + 1][c] === 1) return 'bottom';
    if (c > 0            && map[r][c - 1] === 1) return 'left';
    if (c < MAZE_COLS-1  && map[r][c + 1] === 1) return 'right';
    return 'top';
}

// ── Win screen state ──────────────────────────────────────────
let winState = null; // null = not won, otherwise { time, particles, tick, nextCountdown }

function checkWin() {
    const c = Math.floor(player.x / TILE_SIZE), r = Math.floor(player.y / TILE_SIZE);
    if (map[r][c] === 3 && !winState) {
        clearInterval(gameInterval);
        const finalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        winState = {
            time: finalTime,
            tick: 0,
            nextCountdown: 4.0,
            particles: buildWinParticles()
        };
        // block game input
        isPlaying = false;
    }
}

function buildWinParticles() {
    const pts = [];
    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        pts.push({
            x: canvas.width  / 2,
            y: canvas.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 3 + Math.random() * 5,
            hue: Math.floor(Math.random() * 360),
            alpha: 1,
            life: 0.7 + Math.random() * 0.3
        });
    }
    return pts;
}

function drawWinScreen() {
    const ws = winState;
    ws.tick++;

    // ── dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const t  = ws.tick;

    // ── update + draw particles
    for (const p of ws.particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.12; // gravity
        p.alpha -= 0.008 / p.life;
        if (p.alpha < 0) p.alpha = 0;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ── pulsing outer ring
    const ringPulse = 1 + 0.04 * Math.sin(t * 0.08);
    ctx.save();
    ctx.strokeStyle = `rgba(0, 255, 180, ${0.3 + 0.2 * Math.sin(t * 0.06)})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur  = 30;
    ctx.shadowColor = '#00ffb4';
    ctx.beginPath();
    ctx.arc(cx, cy, 200 * ringPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 155 * ringPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ── "YOU ESCAPED" title
    const titleScale = Math.min(1, t / 18);
    ctx.save();
    ctx.translate(cx, cy - 70);
    ctx.scale(titleScale, titleScale);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 52px "Courier New", monospace';
    ctx.shadowBlur   = 40;
    ctx.shadowColor  = '#00ffb4';
    ctx.fillStyle    = '#00ffb4';
    ctx.fillText('YOU ESCAPED', 0, 0);
    // white inner text
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#ffffff';
    ctx.font       = 'bold 50px "Courier New", monospace';
    ctx.fillText('YOU ESCAPED', 0, 0);
    ctx.restore();

    // ── time display
    if (t > 14) {
        const timeAlpha = Math.min(1, (t - 14) / 12);
        ctx.save();
        ctx.globalAlpha  = timeAlpha;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = '22px "Courier New", monospace';
        ctx.fillStyle    = '#888';
        ctx.fillText('TIME', cx, cy - 4);
        ctx.font         = 'bold 46px "Courier New", monospace';
        ctx.shadowBlur   = 20;
        ctx.shadowColor  = '#ff3e3e';
        ctx.fillStyle    = '#ff3e3e';
        ctx.fillText(ws.time + 's', cx, cy + 40);
        ctx.restore();
    }

    // ── countdown to next maze
    ws.nextCountdown -= 1 / 60;
    if (ws.nextCountdown < 0) ws.nextCountdown = 0;

    if (t > 28) {
        const cdAlpha = Math.min(1, (t - 28) / 10);
        const cdInt   = Math.ceil(ws.nextCountdown);
        ctx.save();
        ctx.globalAlpha  = cdAlpha;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = '16px "Courier New", monospace';
        ctx.fillStyle    = '#666';
        ctx.fillText('NEXT MAZE IN', cx, cy + 108);
        ctx.font         = 'bold 38px "Courier New", monospace';
        ctx.shadowBlur   = 14;
        ctx.shadowColor  = '#ffffff';
        ctx.fillStyle    = '#ffffff';
        ctx.fillText(cdInt > 0 ? cdInt : '...', cx, cy + 145);
        ctx.restore();
    }

    // ── trigger next level
    if (ws.nextCountdown <= 0 && t > 28) {
        winState = null;
        loadLevel();
        isPlaying = false; // wait for keypress to start timer
    }
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

let respawnFx = null;   // { x, y, tick, particles, flashAlpha }

function triggerRespawnFx(x, y) {
    const particles = [];
    for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2;
        const speed = 2.5 + Math.random() * 3.5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            size: 3 + Math.random() * 3
        });
    }
    respawnFx = { x, y, tick: 0, particles, flashAlpha: 0.45 };
}

function drawRespawnFx() {
    const fx = respawnFx;
    fx.tick++;

    // ── screen flash — drawn in screen space, reset transform so camera offset is ignored
    if (fx.flashAlpha > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(255, 40, 40, ${fx.flashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        fx.flashAlpha -= 0.035;
    }

    // everything below is in world space (ctx already translated by camera)
    const t = fx.tick;

    // ── shockwave rings expanding outward
    for (let ring = 0; ring < 2; ring++) {
        const delay  = ring * 6;
        const radius = Math.max(0, (t - delay) * 3.5);
        const alpha  = Math.max(0, 1 - (t - delay) / 18);
        if (alpha <= 0) continue;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 80, 80, ${alpha})`;
        ctx.lineWidth   = 2.5 - ring * 0.8;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#ff2222';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // ── respawn beacon: pulsing glow at the landing spot
    if (t < 40) {
        const beaconAlpha = Math.max(0, 1 - t / 40);
        const beaconSize  = player.size * (0.6 + 0.4 * Math.sin(t * 0.4));
        ctx.save();
        ctx.shadowBlur  = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle   = `rgba(255, 255, 255, ${beaconAlpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, beaconSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ── debris particles flying outward then fading
    let anyAlive = false;
    for (const p of fx.particles) {
        p.x     += p.vx;
        p.y     += p.vy;
        p.vx    *= 0.88;
        p.vy    *= 0.88;
        p.alpha -= 0.038;
        if (p.alpha <= 0) continue;
        anyAlive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = '#ff4444';
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ── clear once everything has faded
    if (!anyAlive && t >= 40 && fx.flashAlpha <= 0) {
        respawnFx = null;
    }
}

function die() {
    if (justDied) return;
    justDied = true;

    // Respawn at the oldest trail point — furthest back along the path the player walked.
    // trail[0] is the oldest surviving point (up to TRAIL_MAX_AGE ms ago), acting as a
    // rolling checkpoint. If the trail is somehow empty, fall back to wherever the player
    // currently is (no punishment) rather than snapping to the map origin.
    const respawnPoint = trail.length > 0
        ? trail[0]
        : { x: player.x, y: player.y };

    player.x = respawnPoint.x;
    player.y = respawnPoint.y;

    // Seed a fresh trail from the respawn spot so the next death always has
    // a valid anchor and never regresses further than this point.
    trail = [{ x: player.x, y: player.y, time: Date.now() }];

    camera.x -= camera.x * 0.1; camera.y -= camera.y * 0.1;

    triggerRespawnFx(player.x, player.y);
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    const startCol = Math.floor(camera.x / TILE_SIZE);
    const endCol   = startCol + (canvas.width  / TILE_SIZE) + 1;
    const startRow = Math.floor(camera.y / TILE_SIZE);
    const endRow   = startRow + (canvas.height / TILE_SIZE) + 1;

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS) continue;
            const tile = map[r][c];
            const x = c * TILE_SIZE, y = r * TILE_SIZE;

            if (tile === 1) {
                ctx.fillStyle = '#444'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#222'; ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            } else if (tile === 2) {
                const dir = getSpikeDirection(r, c);
                ctx.fillStyle = '#ff0000';
                const count = 3, sWidth = TILE_SIZE / count;
                for (let i = 0; i < count; i++) {
                    ctx.beginPath();
                    if (dir === 'top') {
                        ctx.moveTo(x + i*sWidth, y); ctx.lineTo(x+(i+.5)*sWidth, y+SPIKE_SIZE); ctx.lineTo(x+(i+1)*sWidth, y);
                    } else if (dir === 'bottom') {
                        ctx.moveTo(x+i*sWidth, y+TILE_SIZE); ctx.lineTo(x+(i+.5)*sWidth, y+TILE_SIZE-SPIKE_SIZE); ctx.lineTo(x+(i+1)*sWidth, y+TILE_SIZE);
                    } else if (dir === 'left') {
                        ctx.moveTo(x, y+i*sWidth); ctx.lineTo(x+SPIKE_SIZE, y+(i+.5)*sWidth); ctx.lineTo(x, y+(i+1)*sWidth);
                    } else if (dir === 'right') {
                        ctx.moveTo(x+TILE_SIZE, y+i*sWidth); ctx.lineTo(x+TILE_SIZE-SPIKE_SIZE, y+(i+.5)*sWidth); ctx.lineTo(x+TILE_SIZE, y+(i+1)*sWidth);
                    }
                    ctx.fill();
                }
            } else if (tile === 3) {
                ctx.fillStyle = '#00ff00'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ff00';
                ctx.fillRect(x+5, y+5, TILE_SIZE-10, TILE_SIZE-10); ctx.shadowBlur = 0;
            } else if (tile === 4) {
                ctx.fillStyle = '#0000ff'; ctx.globalAlpha = 0.3;
                ctx.fillRect(x+5, y+5, TILE_SIZE-10, TILE_SIZE-10); ctx.globalAlpha = 1.0;
            }
        }
    }

    // Draw trail with stylized effect
    const now = Date.now();
    
    // Draw connecting line between trail points
    if (trail.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.stroke();
    }
    
    // Draw trail nodes as energy bursts
    for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const age = now - point.time;
        const alpha = Math.max(0, 1 - (age / TRAIL_MAX_AGE));
        
        // Pulsating effect with sine wave
        const pulse = 0.6 + 0.4 * Math.sin(now * 0.008 + i * 0.3);
        const size = 8 * alpha * pulse;
        
        // Draw outer glow
        ctx.fillStyle = `rgba(0, 255, 200, ${alpha * 0.4 * pulse})`;
        ctx.shadowBlur = 20 * alpha;
        ctx.shadowColor = `rgba(0, 255, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Draw inner bright core
        ctx.fillStyle = `rgba(100, 255, 255, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw star pattern overlay
        if (alpha > 0.3) {
            drawStar(ctx, point.x, point.y, 4, size * 0.8, size * 0.3, `rgba(0, 255, 200, ${alpha * 0.6})`);
        }
    }
    
    // Draw player
    if (respawnFx) drawRespawnFx();

    ctx.fillStyle = player.isHiding ? 'rgba(255,255,255,0.3)' : '#fff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.size/2, 0, Math.PI*2); ctx.fill();

    enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.angle);
        ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';
        ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        ctx.restore();
    });

    ctx.restore();

    // ── Win screen overlay (drawn on top, in screen space)
    if (winState) {
        drawWinScreen();
    }

    requestAnimationFrame(() => { update(); draw(); });
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

setTimeout(() => { document.getElementById('ui').classList.add('minimized'); }, 10000);

loadLevel();
draw();
