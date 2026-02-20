const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const roomCountEl = document.getElementById("roomCount");
const statusEl = document.getElementById("status");
const starOverlay = document.getElementById("star-overlay");
const triangleOverlay = document.getElementById("triangle-overlay");
const raintangleOverlay = document.getElementById("raintangle-overlay");
const semiOverlay = document.getElementById("semi-overlay");
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
let raintangle = {
    active: false,
    timer: 0,
    spawnThreshold: 900,
    duration: 0,
    maxDuration: 300,
    warningSign: false,
    dying: false,   // true once maxDuration hit — drops drain but hitbox is off
    drops: []
};
// Semi: spawns inside a specific room, approaches when looked at
let semi = {
    active: false,          // currently alive in a room
    fadeState: 'none',      // 'in' | 'alive' | 'out' | 'none'
    alpha: 0,               // current opacity (0–1) for fade in/out
    fadeSpeed: 0.025,       // how fast alpha changes per frame
    roomIndex: -1,          // which map segment it spawned in
    x: 0,                   // world x
    y: 0,                   // world y
    width: 90,              // semi-circle elongated width
    height: 44,             // semi-circle height (half)
    distance: 0,            // distance from player (closes when looked at)
    spawnChance: 0.18,      // chance per new room chunk
    spiralAngle: 0,         // rotating spiral
    approachSpeed: 1.2,     // pixels per frame when stared at
    retreatSpeed: 0.4,      // pixels per frame when looked away
    minDistance: 0,         // dies the player when distance <= minDistance
    tintAlpha: 0            // room tint alpha (animated)
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
    raintangleOverlay.classList.remove('warning-raintangle');
    raintangle.active = false;
    raintangle.warningSign = false;
    raintangle.dying = false;
    raintangle.timer = -300;
    raintangle.spawnThreshold = 900 + Math.random() * 500;
    raintangle.duration = 0;
    raintangle.drops = [];
    semi.active = false;
    semi.fadeState = 'none';
    semi.alpha = 0;
    semi.roomIndex = -1;
    semi.tintAlpha = 0;
    semiOverlay.classList.remove('warning-semi');
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
            safeSpot: Math.random() < 0.7 ? { x: x + 200 + Math.random() * (ROOM_WIDTH - 400) } : null,
            hasSemi: !semi.active && Math.random() < semi.spawnChance
        });
        x += ROOM_WIDTH;
        map.push({ type: 'door', x: x, width: 100 });
        x += 100;
    }
}

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Mouse tracking (screen-space)
let mouse = { x: 0, y: 0 };
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

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

    // Raintangle
    if (!raintangle.active) {
        raintangle.timer++;
        if (raintangle.timer > raintangle.spawnThreshold - 180 && raintangle.timer < raintangle.spawnThreshold) {
            raintangle.warningSign = true;
            raintangleOverlay.classList.add('warning-raintangle');
        }
        if (raintangle.timer > raintangle.spawnThreshold) {
            raintangle.active = true;
            raintangle.duration = 0;
            raintangle.drops = [];
            raintangle.warningSign = false;
            raintangleOverlay.classList.remove('warning-raintangle');
        }
    } else {
        raintangle.duration++;

        // Spawn new drops across the visible screen (stop when dying)
        if (!raintangle.dying) {
            for (let i = 0; i < 6; i++) {
                raintangle.drops.push({
                    x: camera.x + Math.random() * canvas.width,
                    y: canvas.height / 2 - 70 - Math.random() * 40,
                    speed: 8 + Math.random() * 6,
                    length: 12 + Math.random() * 14,
                    opacity: 0.7 + Math.random() * 0.3
                });
            }
        }

        // Move drops downward
        raintangle.drops.forEach(d => d.y += d.speed);

        // Check if any drop hits the player (who is NOT under a door)
        // Hitbox is disabled once the fade-out begins (dying = true)
        const playerSeg = map.find(s => player.x >= s.x && player.x < s.x + s.width);
        const playerUnderDoor = playerSeg && playerSeg.type === 'door';

        if (!playerUnderDoor && !raintangle.dying) {
            for (const d of raintangle.drops) {
                if (Math.abs(d.x - player.x) < 18 &&
                    d.y >= player.y - player.radius &&
                    d.y <= player.y + player.radius + d.length) {
                    die("The Raintangle drenched your fate.", "Stand under a doorway when the screen pulses red!");
                    break;
                }
            }
        }

        // Remove drops that have fallen past the hallway floor
        raintangle.drops = raintangle.drops.filter(d => d.y < canvas.height / 2 + 80);

        // When maxDuration is hit, start dying — stop spawning and disable hitbox
        if (raintangle.duration > raintangle.maxDuration && !raintangle.dying) {
            raintangle.dying = true;
        }

        // Fully deactivate once all remaining drops have drained away
        if (raintangle.dying && raintangle.drops.length === 0) {
            raintangle.active = false;
            raintangle.dying = false;
            raintangle.timer = 0;
            raintangle.spawnThreshold = 800 + Math.random() * 700;
        }
    }

    // Semi – room-based entity: approaches when player looks at it
    if (!semi.active) {
        // Handle fade-out finishing after despawn
        if (semi.fadeState === 'out') {
            semi.alpha -= semi.fadeSpeed;
            if (semi.alpha <= 0) {
                semi.alpha = 0;
                semi.fadeState = 'none';
                semiOverlay.classList.remove('warning-semi');
            }
        }

        // Check if the player just entered a semi-tagged room
        const semiRoom = map.find(s => s.type === 'hall' && s.hasSemi &&
            player.x >= s.x && player.x < s.x + s.width);
        if (semiRoom) {
            semi.active = true;
            semi.fadeState = 'in';
            semi.alpha = 0;
            semi.roomIndex = map.indexOf(semiRoom);
            // Spawn on the far wall of the room, centered vertically
            semi.x = semiRoom.x + semiRoom.width - semi.width - 20;
            semi.y = canvas.height / 2;
            semi.distance = semiRoom.width - semi.width - 40;
            semiOverlay.classList.add('warning-semi');
            semiRoom.hasSemi = false; // consume the spawn flag
        }
    } else {
        // Fade in
        if (semi.fadeState === 'in') {
            semi.alpha += semi.fadeSpeed;
            if (semi.alpha >= 1) {
                semi.alpha = 1;
                semi.fadeState = 'alive';
            }
        }

        semi.spiralAngle += 0.04;

        // Determine if the player is "looking at" semi.
        // The pointer faces toward mouse. We check if the pointer arrow
        // points roughly toward semi (angle diff < 60 deg = looking at it).
        const semiScreenX = semi.x - camera.x;
        const semiScreenY = semi.y;
        const angleToSemi = Math.atan2(semiScreenY - player.y, semiScreenX - (player.x - camera.x));
        const pointerAngle = Math.atan2(mouse.y - player.y, mouse.x - (player.x - camera.x));
        let angleDiff = Math.abs(angleToSemi - pointerAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        const isLooking = angleDiff < Math.PI / 3; // within 60 degrees = looking

        if (isLooking) {
            // Approach the player
            semi.distance -= semi.approachSpeed;
        } else {
            // Slowly drift back to original far-wall position
            const roomSeg = map[semi.roomIndex];
            if (roomSeg) {
                const maxDist = roomSeg.width - semi.width - 40;
                if (semi.distance < maxDist) semi.distance += semi.retreatSpeed;
            }
        }

        // Recalculate world position (moves along x toward player in the room)
        const roomSeg = map[semi.roomIndex];
        if (roomSeg) {
            semi.x = roomSeg.x + semi.distance;
            semi.y = canvas.height / 2;

            // If player leaves the room, start fade-out then despawn
            if (player.x < roomSeg.x || player.x >= roomSeg.x + roomSeg.width) {
                semi.active = false;
                semi.fadeState = 'out';
            }
        }

        // Death: semi reaches/touches the player
        const semiLeft = semi.x - semi.width / 2;
        const semiRight = semi.x + semi.width / 2;
        const semiTop = semi.y - semi.height;
        const semiBottom = semi.y;
        if (player.x >= semiLeft - player.radius && player.x <= semiRight + player.radius &&
            player.y >= semiTop - player.radius && player.y <= semiBottom + player.radius) {
            die("Semi consumed your gaze.", "Look AWAY from Semi — keep your pointer pointing away from it!");
        }
    }

    // Update status text based on combined warning/active state
    const starWarning = starEnemy.warningSign || starEnemy.active;
    const triWarning = triangleEnemy.warningSign || triangleEnemy.active;
    const rainWarning = raintangle.warningSign || raintangle.active;
    const semiWarning = semi.active || semi.fadeState === 'out';
    const activeCount = [starWarning, triWarning, rainWarning, semiWarning].filter(Boolean).length;

    if (activeCount >= 3) {
        statusEl.innerText = "!!! HIDE + WALLS + DOOR !!!";
        statusEl.style.color = "#ff88ff";
        statusEl.style.textShadow = "0 0 8px yellow, 0 0 12px cyan, 0 0 16px red";
    } else if (starWarning && triWarning) {
        statusEl.innerText = "!!! HIDE + HUG WALLS !!!";
        statusEl.style.color = "#77d8abff";
        statusEl.style.textShadow = "0 0 8px yellow, 0 0 16px cyan";
    } else if (starWarning && rainWarning) {
        statusEl.innerText = "!!! HIDE + GET TO A DOOR !!!";
        statusEl.style.color = "#ffaa44";
        statusEl.style.textShadow = "0 0 8px yellow, 0 0 16px red";
    } else if (triWarning && rainWarning) {
        statusEl.innerText = "!!! WALLS + GET TO A DOOR !!!";
        statusEl.style.color = "#ff6666";
        statusEl.style.textShadow = "0 0 8px cyan, 0 0 16px red";
    } else if (semiWarning && starWarning) {
        statusEl.innerText = "!!! LOOK AWAY + HIDE !!!";
        statusEl.style.color = "#aaaaff";
        statusEl.style.textShadow = "0 0 8px #0044ff, 0 0 16px yellow";
    } else if (semiWarning && triWarning) {
        statusEl.innerText = "!!! LOOK AWAY + HUG WALLS !!!";
        statusEl.style.color = "#88aaff";
        statusEl.style.textShadow = "0 0 8px #0044ff, 0 0 16px cyan";
    } else if (semiWarning && rainWarning) {
        statusEl.innerText = "!!! LOOK AWAY + GET TO A DOOR !!!";
        statusEl.style.color = "#aa88ff";
        statusEl.style.textShadow = "0 0 8px #0044ff, 0 0 16px red";
    } else if (starWarning) {
        statusEl.innerText = "!!! HIDE !!!";
        statusEl.style.color = "yellow";
        statusEl.style.textShadow = "";
    } else if (triWarning) {
        statusEl.innerText = "!!! HUG THE WALLS !!!";
        statusEl.style.color = "cyan";
        statusEl.style.textShadow = "";
    } else if (rainWarning) {
        statusEl.innerText = "!!! GET TO A DOOR !!!";
        statusEl.style.color = "#ff4444";
        statusEl.style.textShadow = "";
    } else if (semiWarning) {
        statusEl.innerText = "!!! LOOK AWAY !!!";
        statusEl.style.color = "#6699ff";
        statusEl.style.textShadow = "0 0 10px #0033cc";
    } else {
        statusEl.innerText = "SAFE";
        statusEl.style.color = "#00ff00";
        statusEl.style.textShadow = "";
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

    if (raintangle.active) {
        ctx.save();
        ctx.strokeStyle = "#ff2222";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ff0000";
        raintangle.drops.forEach(d => {
            ctx.globalAlpha = d.opacity;
            ctx.beginPath();
            ctx.moveTo(d.x - camera.x, d.y);
            ctx.lineTo(d.x - camera.x + 2, d.y + d.length);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Semi
    if (semi.active || semi.fadeState === 'out') {
        const sx = semi.x;
        const sy = semi.y;
        const sw = semi.width;
        const sh = semi.height;
        const alpha = semi.alpha;

        // Dark blue room tint over the current room (fades with semi)
        if (semi.roomIndex >= 0 && semi.roomIndex < map.length) {
            const roomSeg = map[semi.roomIndex];
            ctx.save();
            ctx.globalAlpha = 0.45 * alpha;
            ctx.fillStyle = "rgba(0, 10, 80, 1)";
            ctx.fillRect(roomSeg.x, canvas.height / 2 - 70, roomSeg.width, 140);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);

        // ── Body: elongated white semi-circle (dome up, flat bottom) ──
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = "#aaccff";
        ctx.beginPath();
        ctx.ellipse(0, 0, sw / 2, sh, 0, Math.PI, 0, false);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // ── Rotating black spiral clipped strictly inside the body ──
        ctx.save();
        // Re-define clip path matching the body exactly
        ctx.beginPath();
        ctx.ellipse(0, 0, sw / 2 - 3, sh - 3, 0, Math.PI, 0, false);
        ctx.closePath();
        ctx.clip();

        ctx.rotate(semi.spiralAngle);
        const spiralTurns = 3;
        const spiralMaxR = Math.min(sw / 2, sh) - 8;
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        for (let t = 0; t <= spiralTurns * Math.PI * 2; t += 0.05) {
            const r = (t / (spiralTurns * Math.PI * 2)) * spiralMaxR;
            const px = Math.cos(t) * r;
            const py = Math.sin(t) * r;
            if (t === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        ctx.restore(); // globalAlpha reset
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

    // Draw pointer toward mouse (folded/concave triangle)
    // Both mouse and player position are in screen-space here — no diagonal drift.
    const pointerAngle = Math.atan2(mouse.y - player.y, mouse.x - (player.x - camera.x));
    const pointerOffset = renderRadius + 5; // gap from player edge
    const triLen  = 22;  // tip-to-base length
    const triWide = 8;   // half-width at the base corners
    const foldIn  = 9;   // how far the notch folds inward from the tip
    const pointerColor = player.isHidden ? "rgba(150,150,150,0.6)" : "rgba(255,255,255,0.9)";

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(pointerAngle);
    ctx.shadowBlur = player.isHidden ? 0 : 8;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.moveTo(pointerOffset + triLen, 0);          // tip
    ctx.lineTo(pointerOffset, -triWide);            // left base corner
    ctx.lineTo(pointerOffset + foldIn, 0);          // centre notch (fold)
    ctx.lineTo(pointerOffset, triWide);             // right base corner
    ctx.closePath();
    ctx.fillStyle = pointerColor;
    ctx.fill();
    ctx.restore();

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
    if (raintangle.warningSign) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,50,50,0.6)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "red";
        for (let i = 0; i < 8; i++) {
            const rx = Math.random() * canvas.width;
            const ry = Math.random() * canvas.height;
            const rlen = 10 + Math.random() * 12;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + 2, ry + rlen);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
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
