class PathsOfPain {
    constructor(canvasId, timerId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.timerEl = document.getElementById(timerId);
        
        this.tileSize = 40;
        this.startTime = Date.now();
        this.gameOver = false;
        
        // P=Player, 1=Wall, S=Spikes, L=Lava, G=Goal
        this.map = [
            [1,1,1,1,1,1,1,1,1,1],
            [1,"P",0,0,0,1,0,0,0,1],
            [1,1,1,0,0,1,0,"S",0,1],
            [1,0,0,0,0,0,0,1,0,1],
            [1,0,"L","L",0,1,0,0,0,1],
            [1,0,1,1,0,1,1,1,0,1],
            [1,0,0,"S",0,0,0,0,0,1],
            [1,1,1,1,1,1,"S",1,0,1],
            [1,0,0,0,0,0,0,0,"G",1],
            [1,1,1,1,1,1,1,1,1,1],
        ];

        this.player = {
            x: 1,
            y: 1,
            vx: 0,
            vy: 0,
            moving: false,
            color: "#00ffff"
        };

        this.init();
    }

    init() {
        window.addEventListener("keydown", (e) => this.handleInput(e));
        this.gameLoop();
    }

    handleInput(e) {
        if (this.player.moving || this.gameOver) return;

        const keys = {
            ArrowUp: { vx: 0, vy: -1 },
            ArrowDown: { vx: 0, vy: 1 },
            ArrowLeft: { vx: -1, vy: 0 },
            ArrowRight: { vx: 1, vy: 0 }
        };

        if (keys[e.key]) {
            this.player.vx = keys[e.key].vx;
            this.player.vy = keys[e.key].vy;
            this.player.moving = true;
        }
    }

    update() {
        if (this.gameOver) return;

        if (this.player.moving) {
            let nextX = this.player.x + this.player.vx;
            let nextY = this.player.y + this.player.vy;

            // Check if next tile is a wall
            if (this.map[nextY][nextX] !== 1) {
                this.player.x = nextX;
                this.player.y = nextY;
                this.checkStatus(this.map[nextY][nextX]);
            } else {
                this.player.moving = false;
            }
        }

        this.timerEl.innerText = ((Date.now() - this.startTime) / 1000).toFixed(2);
    }

    checkStatus(tileType) {
        if (tileType === "S" || tileType === "L") {
            this.die();
        } else if (tileType === "G") {
            this.win();
        }
    }

    die() {
        alert("CRUSHED! Back to the start.");
        this.player.x = 1;
        this.player.y = 1;
        this.player.moving = false;
        this.startTime = Date.now();
    }

    win() {
        this.gameOver = true;
        alert(`ESCAPE SUCCESSFUL! Time: ${this.timerEl.innerText}s`);
        location.reload();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.map.forEach((row, y) => {
            row.forEach((tile, x) => {
                this.drawTile(x, y, tile);
            });
        });

        this.drawPlayer();
    }

    drawTile(x, y, type) {
        const colors = {
            1: "#333",    // Wall
            "S": "#ff6600", // Spikes
            "L": "#ff0000", // Lava
            "G": "#00ff00", // Goal
            0: "#111",    // Floor
            "P": "#111"   // Player start is floor
        };

        this.ctx.fillStyle = colors[type] || "#111";
        this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        this.ctx.strokeStyle = "#222";
        this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
    }

    drawPlayer() {
        this.ctx.fillStyle = this.player.color;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.player.color;
        this.ctx.fillRect(
            this.player.x * this.tileSize + 8, 
            this.player.y * this.tileSize + 8, 
            this.tileSize - 16, 
            this.tileSize - 16
        );
        this.ctx.shadowBlur = 0;
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game
const game = new PathsOfPain("gameCanvas", "timer");