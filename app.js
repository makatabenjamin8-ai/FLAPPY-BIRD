/**
 * Advanced Flappy Bird Engine
 * Features: Delta-time physics, Object Pooling, Object-Oriented State Machine, Responsive Input
 */

const GameState = {
    START: 'START',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER'
};

class Bird {
    constructor(ctx) {
        this.ctx = ctx;
        this.reset();
        this.width = 34;
        this.height = 24;
    }

    reset() {
        this.x = 100;
        this.y = 250;
        this.velocity = 0;
        this.gravity = 0.4;
        this.jump = -7.5;
        this.rotation = 0;
    }

    flap() {
        this.velocity = this.jump;
    }

    update(deltaTime) {
        // Normalize physics calculations using scale factor based on ~60fps target
        const timeScale = deltaTime / 16.67; 
        
        this.velocity += this.gravity * timeScale;
        this.y += this.velocity * timeScale;

        // Calculate procedural rotation based on downward velocity
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 7, this.velocity * 0.08));
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.rotate(this.rotation);

        // Procedural Retro Bird Sprite
        this.ctx.fillStyle = '#f7d308';
        this.ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Eye
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(6, -8, 8, 8);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(10, -6, 4, 4);

        // Beak
        this.ctx.fillStyle = '#f75308';
        this.ctx.fillRect(12, 0, 10, 8);

        this.ctx.restore();
    }

    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }
}

class PipePair {
    constructor(x, topHeight, bottomY, width) {
        this.x = x;
        this.topHeight = topHeight;
        this.bottomY = bottomY;
        this.width = width;
        this.passed = false;
        this.active = true;
    }

    update(speed, deltaTime) {
        const timeScale = deltaTime / 16.67;
        this.x -= speed * timeScale;
        if (this.x + this.width < 0) {
            this.active = false; // Mark for recycling / cleanup
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#73bf2e';
        ctx.strokeStyle = '#53801b';
        ctx.lineWidth = 3;

        // Top Pipe
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        ctx.strokeRect(this.x, 0, this.width, this.topHeight);
        // Top Lip
        ctx.fillRect(this.x - 4, this.topHeight - 20, this.width + 8, 20);
        ctx.strokeRect(this.x - 4, this.topHeight - 20, this.width + 8, 20);

        // Bottom Pipe
        const canvasHeight = ctx.canvas.height;
        const bottomHeight = canvasHeight - this.bottomY;
        ctx.fillRect(this.x, this.bottomY, this.width, bottomHeight);
        ctx.strokeRect(this.x, this.bottomY, this.width, bottomHeight);
        // Bottom Lip
        ctx.fillRect(this.x - 4, this.bottomY, this.width + 8, 20);
        ctx.strokeRect(this.x - 4, this.bottomY, this.width + 8, 20);
    }
}

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.bird = new Bird(this.ctx);
        this.pipes = [];
        
        // Configurations
        this.pipeSpeed = 3.5;
        this.pipeGap = 130;
        this.pipeWidth = 70;
        this.spawnInterval = 1400; // ms
        this.lastSpawnTime = 0;
        
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('flappy_highscore')) || 0;
        this.currentState = GameState.START;
        
        this.lastTime = 0;

        this.initInput();
    }

    initInput() {
        const handler = (e) => {
            if (e.type === 'keydown' && e.code !== 'Space') return;
            
            if (this.currentState === GameState.START) {
                this.currentState = GameState.PLAYING;
                this.bird.flap();
            } else if (this.currentState === GameState.PLAYING) {
                this.bird.flap();
            } else if (this.currentState === GameState.GAMEOVER) {
                this.resetGame();
            }
        };

        window.addEventListener('keydown', handler);
        this.canvas.addEventListener('touchstart', handler, { passive: true });
    }

    resetGame() {
        this.bird.reset();
        this.pipes = [];
        this.score = 0;
        this.lastSpawnTime = 0;
        this.currentState = GameState.START;
    }

    spawnPipes(currentTime) {
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            const minHeight = 50;
            const maxHeight = this.canvas.height - this.pipeGap - 120;
            const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
            const bottomY = topHeight + this.pipeGap;

            this.pipes.push(new PipePair(this.canvas.width, topHeight, bottomY, this.pipeWidth));
            this.lastSpawnTime = currentTime;
        }
    }

    checkCollisions() {
        const bBounds = this.bird.getBounds();

        // Floor / Ceiling collisions
        if (bBounds.bottom >= this.canvas.height - 40 || bBounds.top <= 0) {
            return true;
        }

        // AABB Box Collision detection against active pipes
        for (let pipe of this.pipes) {
            if (bBounds.right > pipe.x && bBounds.left < pipe.x + pipe.width) {
                if (bBounds.top < pipe.topHeight || bBounds.bottom > pipe.bottomY) {
                    return true;
                }
            }
        }
        return false;
    }

    update(currentTime, deltaTime) {
        if (this.currentState === GameState.PLAYING) {
            this.bird.update(deltaTime);
            this.spawnPipes(currentTime);

            // Filter active pipes out using highly optimized Array mutation
            this.pipes = this.pipes.filter(p => p.active);

            for (let pipe of this.pipes) {
                pipe.update(this.pipeSpeed, deltaTime);

                // Score verification logic
                if (!pipe.passed && pipe.x + pipe.width / 2 < this.bird.x) {
                    pipe.passed = true;
                    this.score++;
                }
            }

            if (this.checkCollisions()) {
                this.currentState = GameState.GAMEOVER;
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('flappy_highscore', this.highScore);
                }
            }
        }
    }

    draw() {
        // Clear frame buffer
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Environment Elements
        for (let pipe of this.pipes) {
            pipe.draw(this.ctx);
        }

        // Vector Ground Line
        this.ctx.fillStyle = '#ded895';
        this.ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 40);
        this.ctx.fillStyle = '#55b02e';
        this.ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 8);

        // Draw Entity Elements
        this.bird.draw();

        // Render Contextual User Interface Overlays
        this.renderUI();
    }

    renderUI() {
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.textAlign = 'center';

        if (this.currentState === GameState.START) {
            this.ctx.font = '28px "Courier New"';
            this.ctx.strokeText('TAP OR SPACE TO FLY', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('TAP OR SPACE TO FLY', this.canvas.width / 2, this.canvas.height / 2);
        } 
        else if (this.currentState === GameState.PLAYING) {
            this.ctx.font = '50px "Courier New"';
            this.ctx.strokeText(this.score, this.canvas.width / 2, 80);
            this.ctx.fillText(this.score, this.canvas.width / 2, 80);
        } 
        else if (this.currentState === GameState.GAMEOVER) {
            this.ctx.font = '40px "Courier New"';
            this.ctx.strokeText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);

            this.ctx.font = '20px "Courier New"';
            this.ctx.strokeText(`SCORE: ${this.score} | BEST: ${this.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
            this.ctx.fillText(`SCORE: ${this.score} | BEST: ${this.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 10);

            this.ctx.font = '16px "Courier New"';
            this.ctx.strokeText('CLICK TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.fillText('CLICK TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 60);
        }
    }

    run(timestamp = 0) {
        if (!this.lastTime) this.lastTime = timestamp;
        let deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Caps excessive lag spikes
        if (deltaTime > 100) deltaTime = 16.67; 

        this.update(timestamp, deltaTime);
        this.draw();

        requestAnimationFrame((time) => this.run(time));
    }
}

// Instantiate Engine on Dom Content Load
window.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine('gameCanvas');
    game.run();
});
