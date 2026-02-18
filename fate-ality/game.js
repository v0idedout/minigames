const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const roomCountEl = document.getElementById("roomCount");
const statusEl = document.getElementById("status");
const starOverlay = document.getElementById("star-overlay");
const triangleOverlay = document.getElementById("triangle-overlay");
const blocker = document.getElementById("blocker");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game State
let isPlaying = false;
let roomsCleared = 0;
let player = {
    x: 100, y: 0, radius: 15, speed: 5,
    isHidden: false,
    isJumping: false,
    jumpTime: 0,
    jumpMaxTime: 40
};
let camera = { x: 0 };
let map = [];
let starEnemy = {
    active: false,
    x: 0,
    timer: 0,
    spawnThreshold: 600,
    speed: 20,
    warningSign: false,
    rotation: 0,
    particles: []
};
let triangleEnemy = {
    active: false,
    x: 0,
    timer: 0,
    spawnThreshold: 1000,
    speed: 45,
    warningSign: false,
    rotation: 0,
    segments: 15,
    segmentSize: 60
};

const HALL_HEIGHT = 200;
const ROOM_WIDTH = 800;
const SAFE_SPOT_WIDTH = 60;

function init() {
    player.y = canvas.height / 2;
    player.x = 100;
    map = [];
    roomsCleared = 0;
    roomCountEl.innerText = 0;
    camera.x = 0;
    generateMapChunk(0);
    starEnemy.active = false;
    starEnemy.warningSign = false;
    starEnemy.timer = -200;
    starEnemy.spawnThreshold = 600 + Math.random() * 400;
    starEnemy.particles = [];
    triangleEnemy.active = false;
    triangleEnemy.warningSign = false;
    triangleEnemy.timer = -400;
    triangleEnemy.spawnThreshold = 1000 + Math.random() * 600;
    starOverlay.classList.remove('warning-star');
    triangleOverlay.classList.remove('warning-triangle');
    statusEl.innerText = "READY";
    statusEl.style.color = "#00ff00";
}

function generateMapChunk(startX) {
    let x = startX;
    for (let i = 0; i < 5; i++) {
        map.push({
            type: 'hall',
            x: x,
            width: ROOM_WIDTH,
            safeSpot: Math.random() < 0.7 ? { x: x + 200 + Math.random() * (ROOM_WIDTH - 400) } : null
        });
        x += ROOM_WIDTH;
        map.push({ type: 'door', x: x, width: 100 });
        x += 100;
    }
}

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

blocker.addEventListener('click', () => {
    blocker.style.display = 'none';
    isPlaying = true;
    init();
});

function update() {
    if (!isPlaying) return;

    let currentSpeed = keys['ShiftLeft'] ? player.speed * 1.8 : player.speed;
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['ArrowUp'])    dy -= currentSpeed;
    if (keys['KeyS'] || keys['ArrowDown'])  dy += currentSpeed;
    if (keys['KeyA'] || keys['ArrowLeft'])  dx -= currentSpeed;
    if (keys['KeyD'] || keys['ArrowRight']) dx += currentSpeed;

    const getYLimit = (x) => {
        const seg = map.find(s => x >= s.x && x < s.x + s.width);
        if (seg && seg.type === 'door') {
            const relX = x - seg.x;
            if (relX < 30 || relX > 70) return 50;
            return 80;
        }
        return 70;
    };

    let nextLimit = getYLimit(player.x + dx);
    if (Math.abs(player.y - canvas.height / 2) <= nextLimit) {
        player.x += dx;
    }
    player.x = Math.max(0, player.x);

    let currentLimit = getYLimit(player.x);
    player.y = Math.max(canvas.height / 2 - currentLimit, Math.min(player.y + dy, canvas.height / 2 + currentLimit));

    if (keys['Space'] && !player.isJumping) {
        player.isJumping = true;
        player.jumpTime = 0;
    }
    if (player.isJumping) {
        player.jumpTime++;
        if (player.jumpTime >= player.jumpMaxTime) {
            player.isJumping = false;
            player.jumpTime = 0;
        }
    }

    player.isHidden = false;
    if (keys['KeyC'] && !player.isJumping) {
        map.forEach(segment => {
            if (segment.type === 'hall' && segment.safeSpot) {
                const ssX = segment.safeSpot.x;
                if (player.x > ssX && player.x < ssX + SAFE_SPOT_WIDTH) {
                    player.isHidden = true;
                }
            }
        });
    }

    camera.x = player.x - 200;

    const currentRoom = Math.floor(player.x / (ROOM_WIDTH + 100));
    if (currentRoom > roomsCleared) {
        roomsCleared = currentRoom;
        roomCountEl.innerText = roomsCleared;
        if (map.length - (roomsCleared * 2) < 5) {
            generateMapChunk(map[map.length - 1].x + map[map.length - 1].width);
        }
    }

    // Star Enemy
    if (!starEnemy.active) {
        starEnemy.timer++;
        if (starEnemy.timer > starEnemy.spawnThreshold - 200 && starEnemy.timer < starEnemy.spawnThreshold) {
            starEnemy.warningSign = true;
            starOverlay.classList.add('warning-star');
            statusEl.innerText = "!!! HIDE !!!";
            statusEl.style.color = "yellow";
        }
        if (starEnemy.timer > starEnemy.spawnThreshold) {
            starEnemy.active = true;
            starEnemy.x = camera.x - 500;
            starEnemy.warningSign = false;
            starOverlay.classList.remove('warning-star');
        }
    } else {
        starEnemy.x += starEnemy.speed;
        starEnemy.rotation += 0.12;

        if (starEnemy.x < camera.x + canvas.width + 100) {
            starEnemy.particles.push({
                x: starEnemy.x - (Math.random() * 30),
                y: canvas.height / 2 + (Math.random() - 0.5) * 80,
                size: 5 + Math.random() * 12,
                opacity: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2
            });
        }

        starEnemy.particles.forEach(p => {
            p.opacity -= 0.02;
            p.rotation += p.rotSpeed;
            p.x += starEnemy.speed * 0.05;
        });
        starEnemy.particles = starEnemy.particles.filter(p => p.opacity > 0);

        if (starEnemy.x > player.x + canvas.width && starEnemy.particles.length === 0) {
            starEnemy.active = false;
            starEnemy.timer = 0;
            starEnemy.spawnThreshold = 600 + Math.random() * 600;
            if (Math.random() < 0.7) triangleEnemy.timer += 300;
            statusEl.innerText = "SAFE";
            statusEl.style.color = "#00ff00";
        }

        if (Math.abs(starEnemy.x - player.x) < 50) {
            if (!player.isHidden) {
                die("The Star claimed your soul.", "Hide in the yellow alcoves when the screen sparkles yellow!");
            }
        }
    }

    // Triangle Enemy
    if (!triangleEnemy.active) {
        triangleEnemy.timer++;
        if (triangleEnemy.timer > triangleEnemy.spawnThreshold - 200 && triangleEnemy.timer < triangleEnemy.spawnThreshold) {
            triangleEnemy.warningSign = true;
            triangleOverlay.classList.add('warning-triangle');
            statusEl.innerText = "!!! HUG THE WALLS !!!";
            statusEl.style.color = "cyan";
        }
        if (triangleEnemy.timer > triangleEnemy.spawnThreshold) {
            triangleEnemy.active = true;
            triangleEnemy.x = camera.x - 1000;
            triangleEnemy.warningSign = false;
            triangleOverlay.classList.remove('warning-triangle');
        }
    } else {
        triangleEnemy.x += triangleEnemy.speed;

        if (triangleEnemy.x > player.x + canvas.width + (triangleEnemy.segments * triangleEnemy.segmentSize)) {
            triangleEnemy.active = false;
            triangleEnemy.timer = 0;
            triangleEnemy.spawnThreshold = 800 + Math.random() * 800;
            if (Math.random() < 0.7) starEnemy.timer += 200;
            statusEl.innerText = "SAFE";
            statusEl.style.color = "#00ff00";
        }

        const bodyLength = triangleEnemy.segments * triangleEnemy.segmentSize;
        if (player.x > triangleEnemy.x - bodyLength && player.x < triangleEnemy.x) {
            const limit = getYLimit(player.x);
            const nearWall = Math.abs(player.y - (canvas.height / 2 - limit)) < 15 ||
                             Math.abs(player.y - (canvas.height / 2 + limit)) < 15;
            if (!nearWall) {
                die("The Triangle pierced your fate.", "Stay close to the hallway walls when the screen glows cyan!");
            }
        }
    }
}

function die(message, tip) {
    isPlaying = false;
    blocker.style.display = 'flex';
    document.querySelector('#instructions h1').innerText = "FATE-AL ERROR";
    const ps = document.querySelectorAll('#instructions p');
    if (ps.length >= 1) ps[0].innerText = message || "You perished in the abyss.";
    if (ps.length >= 2) ps[1].innerText = tip || "Stay focused.";
}

function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, 0);

    map.forEach(segment => {
        if (segment.x + segment.width < camera.x || segment.x > camera.x + canvas.width) return;

        if (segment.type === 'hall') {
            ctx.fillStyle = "#331a00";
            ctx.fillRect(segment.x, canvas.height / 2 - 70, segment.width, 140);
            ctx.strokeStyle = "#553311";
            ctx.lineWidth = 2;
            for (let i = 0; i < segment.width; i += 40) {
                ctx.strokeRect(segment.x + i, canvas.height / 2 - 70, 40, 140);
            }
            if (segment.safeSpot) {
                ctx.fillStyle = "#ffff99";
                ctx.shadowBlur = 15;
                ctx.shadowColor = "#ffff00";
                ctx.fillRect(segment.safeSpot.x, canvas.height / 2 - 65, SAFE_SPOT_WIDTH, 130);
                ctx.shadowBlur = 0;
            }
        } else {
            ctx.fillStyle = "#004400";
            ctx.fillRect(segment.x, canvas.height / 2 - 80, segment.width, 160);
        }
    });

    if (starEnemy.active) {
        starEnemy.particles.forEach(p => {
            ctx.save();
            const shimmer = p.opacity * (0.7 + Math.random() * 0.3);
            ctx.globalAlpha = shimmer;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.shadowBlur = 10;
            ctx.shadowColor = "yellow";
            drawStar(0, 0, 4, p.size, p.size / 3, `rgba(255, 255, 0, ${shimmer})`);
            ctx.restore();
        });

        ctx.save();
        ctx.translate(starEnemy.x, canvas.height / 2);
        ctx.rotate(starEnemy.rotation);
        ctx.shadowBlur = 30;
        ctx.shadowColor = "yellow";
        drawStar(0, 0, 5, 45, 22);
        ctx.restore();
    }

    if (triangleEnemy.active) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = "cyan";
        for (let i = 0; i < triangleEnemy.segments; i++) {
            let segX = triangleEnemy.x - (i * triangleEnemy.segmentSize);
            let segY = canvas.height / 2 + Math.sin((triangleEnemy.x / 100) - (i * 0.5)) * 10;
            drawTriangle(segX, segY, triangleEnemy.segmentSize, "cyan", 0);
        }
        ctx.restore();
    }

    let jumpScale = 0;
    if (player.isJumping) {
        jumpScale = Math.sin((player.jumpTime / player.jumpMaxTime) * Math.PI);
    }

    if (player.isJumping) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        let shadowSize = (player.radius + 5) + (jumpScale * 10);
        ctx.arc(player.x, player.y + 5, shadowSize, 0, Math.PI * 2);
        ctx.fill();
    }

    let renderRadius = player.radius + (jumpScale * 10);
    ctx.fillStyle = player.isHidden ? "#555" : "#fff";
    ctx.shadowBlur = player.isHidden ? 0 : 10;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, renderRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    map.forEach(segment => {
        if (segment.type === 'door') {
            if (segment.x + segment.width < camera.x || segment.x > camera.x + canvas.width) return;
            ctx.fillStyle = "#996633";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#000";
            ctx.fillRect(segment.x + 30, canvas.height / 2 - 50, 40, 100);
            ctx.shadowBlur = 0;
        }
    });

    ctx.restore();

    if (starEnemy.warningSign) {
        for (let i = 0; i < 5; i++) {
            drawStar(Math.random() * canvas.width, Math.random() * canvas.height, 5, 5, 2, "rgba(255,255,0,0.5)");
        }
    }
    if (triangleEnemy.warningSign) {
        for (let i = 0; i < 5; i++) {
            drawTriangle(Math.random() * canvas.width, Math.random() * canvas.height, 15, "rgba(0,255,255,0.5)", Math.random() * Math.PI * 2);
        }
    }

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

function drawTriangle(x, y, size, color, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2.5);
    ctx.lineTo(-size, size / 2.5);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius, color = "yellow") {
    let rot = Math.PI / 2 * 3;
    let x = cx, y = cy;
    const step = Math.PI / spikes;

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
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

draw();
