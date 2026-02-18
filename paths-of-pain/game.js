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
            if (dir === 'top'    && ty < SPIKE_SIZE)              die();
            if (dir === 'bottom' && ty > TILE_SIZE - SPIKE_SIZE)  die();
            if (dir === 'left'   && tx < SPIKE_SIZE)              die();
            if (dir === 'right'  && tx > TILE_SIZE - SPIKE_SIZE)  die();
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

function checkWin() {
    const c = Math.floor(player.x / TILE_SIZE), r = Math.floor(player.y / TILE_SIZE);
    if (map[r][c] === 3) {
        alert("You found the exit! Loading next maze...");
        loadLevel();
    }
}

function die() {
    player.x = 1.5 * TILE_SIZE;
    player.y = 1.5 * TILE_SIZE;
    camera.x = 0; camera.y = 0;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

    ctx.fillStyle = player.isHiding ? 'rgba(255,255,255,0.3)' : '#fff';
    ctx.shadowBlur = player.isHiding ? 5 : 10; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.size/2, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.angle);
        ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';
        ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        ctx.restore();
    });

    ctx.restore();
    requestAnimationFrame(() => { update(); draw(); });
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

setTimeout(() => { document.getElementById('ui').classList.add('minimized'); }, 10000);

loadLevel();
draw();
