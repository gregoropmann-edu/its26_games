let gameState = 'START';
let gameTime = 0;
let lastTime = 0;
let alarmTriggered = false;
let flagCaptured = false;
let swordEquipped = false;
let guardKills = 0;

let cameraX = 0;
let cameraY = 0;

let mouseX = 0;
let mouseY = 0;
let worldMouseX = 0;
let worldMouseY = 0;

class Player {
    constructor(x, y, startingRocks = 10) {
        this.x = x;
        this.y = y;
        this.radius = 13;
        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.angle = 0;
        this.state = 'NORMAL';
        this.isSprinting = false;
        this.speed = 3.2;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.rockCooldown = 0;
        this.rocksRemaining = startingRocks;
        this.attackArc = Math.PI / 1.3;
        this.attackRange = 48;
        this.noiseRadius = 120;
        this.stepTimer = 0;
    }

    update(dt) {
        let moveSpeed = this.speed;
        const isCrouching = keyState.crouch;

        if (keyState.sprint && !isCrouching) {
            if (this.isSprinting) {
                if (this.stamina <= 0) this.isSprinting = false;
            } else {
                if (this.stamina >= 12) this.isSprinting = true;
            }
        } else {
            this.isSprinting = false;
        }

        if (isCrouching) {
            this.state = 'CROUCH';
            moveSpeed = this.speed * 0.45;
            this.noiseRadius = 30;
        } else if (this.isSprinting) {
            this.state = 'SPRINT';
            moveSpeed = this.speed * 1.65;
            this.stamina = Math.max(0, this.stamina - dt * 30);
            this.noiseRadius = 320;
        } else {
            this.state = 'NORMAL';
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 22);
            this.noiseRadius = 130;
        }

        if (this.state === 'CROUCH') {
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 15);
        }

        let dx = 0;
        let dy = 0;

        if (keyState.up) dy -= 1;
        if (keyState.down) dy += 1;
        if (keyState.left) dx -= 1;
        if (keyState.right) dx += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        if (dx !== 0 || dy !== 0) {
            this.stepTimer += dt;
            const stepInterval = this.state === 'SPRINT' ? 0.2 : (this.state === 'CROUCH' ? 0.5 : 0.32);
            if (this.stepTimer >= stepInterval) {
                sfx.footstep(this.state === 'CROUCH');
                this.stepTimer = 0;
            }
        }

        this.moveWithCollision(dx * moveSpeed * dt * 60, dy * moveSpeed * dt * 60);

        if (isMobileDevice) {
            let closestGuard = null;
            let minDistance = 280;

            for (let g of guards) {
                if (g.hp > 0) {
                    const dist = Math.hypot(g.x - this.x, g.y - this.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestGuard = g;
                    }
                }
            }

            if (closestGuard) {
                this.angle = Math.atan2(closestGuard.y - this.y, closestGuard.x - this.x);
                worldMouseX = closestGuard.x;
                worldMouseY = closestGuard.y;
            } else if (dx !== 0 || dy !== 0) {
                this.angle = Math.atan2(dy, dx);
                worldMouseX = this.x + dx * 150;
                worldMouseY = this.y + dy * 150;
            }
        } else {
            this.angle = Math.atan2(worldMouseY - this.y, worldMouseX - this.x);
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                this.isAttacking = false;
            }
        }

        if (this.rockCooldown > 0) {
            this.rockCooldown -= dt;
        }
    }

    moveWithCollision(vx, vy) {
        if (vx !== 0) {
            let nextX = this.x + vx;
            if (!checkTileCollision(nextX, this.y, this.radius)) {
                this.x = nextX;
            }
        }
        if (vy !== 0) {
            let nextY = this.y + vy;
            if (!checkTileCollision(this.x, nextY, this.radius)) {
                this.y = nextY;
            }
        }
    }

    throwRock() {
        if (this.rocksRemaining <= 0) {
            showFloatingText("No Rocks Left!", this.x, this.y - 18, "#ef4444");
            return;
        }
        if (this.rockCooldown > 0) return;

        this.rocksRemaining--;
        this.rockCooldown = 4.0;
        let targetX = worldMouseX;
        let targetY = worldMouseY;

        if (targetX === 0 && targetY === 0) {
            targetX = this.x + Math.cos(this.angle) * 180;
            targetY = this.y + Math.sin(this.angle) * 180;
        }

        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        const maxDist = 260;
        if (dist > maxDist) {
            const ratio = maxDist / dist;
            targetX = this.x + (targetX - this.x) * ratio;
            targetY = this.y + (targetY - this.y) * ratio;
        }

        rockProjectiles.push({
            startX: this.x,
            startY: this.y,
            x: this.x,
            y: this.y,
            targetX: targetX,
            targetY: targetY,
            progress: 0,
            speed: 400
        });

        showFloatingText(`Rock Thrown! (${this.rocksRemaining} left)`, this.x, this.y - 18, "#fef08a");
    }

    attack() {
        if (this.attackCooldown > 0) return;

        this.isAttacking = true;
        this.attackCooldown = 0.35;

        if (swordEquipped) {
            sfx.swordSwing();
            createSlashEffect(this.x, this.y, this.angle, this.attackRange);
            emitNoise(this.x, this.y, 250);

            const hitTileX = Math.floor((this.x + Math.cos(this.angle) * 32) / TILE_SIZE);
            const hitTileY = Math.floor((this.y + Math.sin(this.angle) * 32) / TILE_SIZE);
            if (hitTileY >= 0 && hitTileY < MAP_ROWS && hitTileX >= 0 && hitTileX < MAP_COLS) {
                if (MAP_GRID[hitTileY][hitTileX] === 4) {
                    MAP_GRID[hitTileY][hitTileX] = 0;
                    sfx.guardHit();
                    showFloatingText("WALL BROKEN!", this.x, this.y - 20, "#f59e0b");
                }
            }

            guards.forEach(guard => {
                if (guard.hp <= 0) return;
                const dist = Math.hypot(guard.x - this.x, guard.y - this.y);
                if (dist < this.attackRange + guard.radius) {
                    const angleToGuard = Math.atan2(guard.y - this.y, guard.x - this.x);
                    let angleDiff = Math.abs(this.angle - angleToGuard);
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    angleDiff = Math.abs(angleDiff);

                    if (angleDiff < this.attackArc / 2 + 0.35) {
                        guard.takeDamage(45, this.x, this.y);
                    }
                }
            });
        }
    }
}

