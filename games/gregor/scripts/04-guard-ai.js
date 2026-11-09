function lerpAngle(current, target, turnSpeed, dt) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const maxStep = turnSpeed * dt;
    if (Math.abs(diff) <= maxStep) {
        return target;
    }
    return current + Math.sign(diff) * maxStep;
}

// Grid A* keeps guards from walking into walls during pursuit.
function findGuardPath(startX, startY, targetX, targetY) {
    const toCell = (x, y) => ({ c: Math.max(0, Math.min(MAP_COLS - 1, Math.floor(x / TILE_SIZE))), r: Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(y / TILE_SIZE))) });
    const start = toCell(startX, startY), goal = toCell(targetX, targetY);
    const key = (r, c) => `${r},${c}`;
    const blocked = (r, c) => r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS || [1, 4, 7].includes(MAP_GRID[r][c]);
    if (blocked(goal.r, goal.c)) return [];
    const open = [{ r: start.r, c: start.c, g: 0, f: Math.abs(goal.r-start.r)+Math.abs(goal.c-start.c) }];
    const came = new Map(), cost = new Map([[key(start.r,start.c), 0]]), closed = new Set();
    while (open.length && closed.size < MAP_ROWS * MAP_COLS) {
        open.sort((a,b) => a.f-b.f);
        const cur = open.shift(), ck = key(cur.r,cur.c);
        if (closed.has(ck)) continue;
        if (cur.r === goal.r && cur.c === goal.c) {
            const path = [{ r: goal.r, c: goal.c }];
            let k = ck;
            while (came.has(k)) { const prev = came.get(k); path.push({ r: prev.r, c: prev.c }); k = key(prev.r,prev.c); }
            path.reverse(); path.shift();
            return path.map(cell => ({ x: cell.c*TILE_SIZE+TILE_SIZE/2, y: cell.r*TILE_SIZE+TILE_SIZE/2 }));
        }
        closed.add(ck);
        for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr=cur.r+dr,nc=cur.c+dc,nk=key(nr,nc);
            if (blocked(nr,nc) || closed.has(nk)) continue;
            const ng=cur.g+1;
            if (ng < (cost.get(nk) ?? Infinity)) {
                came.set(nk,{r:cur.r,c:cur.c}); cost.set(nk,ng);
                open.push({r:nr,c:nc,g:ng,f:ng+Math.abs(goal.r-nr)+Math.abs(goal.c-nc)});
            }
        }
    }
    return [];
}

class Guard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.hp = 80;
        this.maxHp = 80;
        this.angle = seededRandom() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.speed = 1.3;
        this.chaseSpeed = 2.3;
        this.turnSpeed = 2.2;
        this.chaseTurnSpeed = 3.8;
        this.state = 'PATROL';
        this.visionRadius = 240;
        this.visionAngle = Math.PI / 3.4;
        this.suspicionTimer = 0;
        this.targetLastKnown = null;
        this.attackCooldown = 0;
        this.patrolTimer = 0;
        this.patrolState = 'WALK';
        this.waitTime = 0;
        this.chaseTimer = 0;
        this.searchTimer = 0;
        this.path = [];
        this.pathIndex = 0;
        this.pathRefresh = 0;
    }

    update(dt) {
        if (this.hp <= 0) return;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        const canSee = this.canSeePlayer();
        const canHear = distToPlayer < player.noiseRadius && player.state !== 'CROUCH';

        if (alarmTriggered && this.state === 'PATROL') {
            this.state = 'SUSPICIOUS';
            this.suspicionTimer = 1.4;
            this.targetLastKnown = { x: player.x, y: player.y };
        }

        switch (this.state) {
            case 'PATROL':
                if (canSee || canHear) {
                    this.state = 'SUSPICIOUS';
                    this.suspicionTimer = 0.8;
                    this.targetLastKnown = { x: player.x, y: player.y };
                } else {
                    this.patrolRandomly(dt);
                }
                break;

            case 'SUSPICIOUS':
                if (canSee) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.suspicionTimer += dt * 2.2;
                    if (this.suspicionTimer > 1.0) {
                        this.state = 'CHASE';
                        this.chaseTimer = 7;
                        triggerAlarm();
                    }
                } else if (canHear) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.suspicionTimer = Math.max(this.suspicionTimer, 1.5);
                }
                if (this.targetLastKnown) {
                    const searchDistance = Math.hypot(this.targetLastKnown.x-this.x, this.targetLastKnown.y-this.y);
                    if (searchDistance > 18) this.moveTowards(this.targetLastKnown.x, this.targetLastKnown.y, this.speed * 0.85, this.turnSpeed, dt);
                    else {
                        this.angle += dt * 1.1;
                        this.searchTimer = Math.max(0, this.searchTimer - dt);
                    }
                }
                this.suspicionTimer -= dt * 0.3;
                if (this.suspicionTimer <= 0) {
                    this.state = 'PATROL';
                    this.targetLastKnown = null;
                    this.path = [];
                }
                break;

            case 'CHASE':
                if (canSee) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.chaseTimer = 7;
                } else {
                    this.chaseTimer -= dt;
                }
                if (this.targetLastKnown) {
                    this.moveTowards(this.targetLastKnown.x, this.targetLastKnown.y, this.chaseSpeed, this.chaseTurnSpeed, dt);
                }
                if (distToPlayer < this.radius + player.radius + 8 && this.attackCooldown <= 0) {
                    player.hp -= 16;
                    this.attackCooldown = 0.75;
                    sfx.guardHit();
                    createBloodParticles(player.x, player.y);
                    showFloatingText("-16", player.x, player.y, "#ef4444");
                    if (player.hp <= 0) triggerGameOver();
                }
                if (this.chaseTimer <= 0 && !canSee) {
                    this.state = 'SUSPICIOUS';
                    this.suspicionTimer = 2.8;
                    this.searchTimer = 2.8;
                    this.path = [];
                }
                break;
        }
    }

    canSeePlayer() {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        const maxDist = player.state === 'CROUCH' ? this.visionRadius * 0.5 : this.visionRadius;

        if (dist > maxDist) return false;

        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        let angleDiff = Math.abs(this.angle - angleToPlayer);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        if (angleDiff > this.visionAngle / 2) return false;

        return !hasLineOfSightObstruction(this.x, this.y, player.x, player.y);
    }

    patrolRandomly(dt) {
        if (this.patrolState === 'WAIT') {
            this.waitTime -= dt;
            this.angle = lerpAngle(this.angle, this.targetAngle, this.turnSpeed * 0.7, dt);
            if (this.waitTime <= 0) {
                this.patrolState = 'WALK';
                this.patrolTimer = 0;
            }
            return;
        }

        this.angle = lerpAngle(this.angle, this.targetAngle, this.turnSpeed, dt);

        this.patrolTimer += dt;
        if (this.patrolTimer > 3.5) {
            if (seededRandom() < 0.35) {
                this.patrolState = 'WAIT';
                this.waitTime = 1.2 + seededRandom() * 1.5;
                this.targetAngle = this.angle + (seededRandom() - 0.5) * (Math.PI * 0.8);
                return;
            } else {
                this.targetAngle = this.angle + (seededRandom() - 0.5) * (Math.PI * 0.7);
                this.patrolTimer = 0;
            }
        }

        const probeDist = 24;
        const probeX = this.x + Math.cos(this.angle) * probeDist;
        const probeY = this.y + Math.sin(this.angle) * probeDist;

        if (checkTileCollision(probeX, probeY, this.radius)) {
            const anglesToTry = [Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI];
            let foundNewDir = false;
            for (let da of anglesToTry) {
                const testAngle = this.angle + da;
                const testX = this.x + Math.cos(testAngle) * (probeDist + 8);
                const testY = this.y + Math.sin(testAngle) * (probeDist + 8);
                if (!checkTileCollision(testX, testY, this.radius)) {
                    this.targetAngle = testAngle;
                    foundNewDir = true;
                    break;
                }
            }
            if (!foundNewDir) {
                this.targetAngle = this.angle + Math.PI;
            }
        } else {
            const frameScale = dt * 60;
            const vx = Math.cos(this.angle) * this.speed * frameScale;
            const vy = Math.sin(this.angle) * this.speed * frameScale;

            let nextX = this.x + vx;
            let nextY = this.y + vy;

            if (!checkTileCollision(nextX, this.y, this.radius)) this.x = nextX;
            if (!checkTileCollision(this.x, nextY, this.radius)) this.y = nextY;
        }
    }

    moveTowards(tx, ty, speed, turnSpeed, dt) {
        this.pathRefresh -= dt;
        if (this.pathRefresh <= 0 || !this.path.length) {
            this.path = findGuardPath(this.x, this.y, tx, ty);
            this.pathIndex = 0;
            this.pathRefresh = 0.45;
        }
        let waypoint = this.path[this.pathIndex];
        if (!waypoint) {
            // If the target is in the same open cell, direct movement is safe.
            waypoint = { x: tx, y: ty };
        }
        if (Math.hypot(waypoint.x-this.x, waypoint.y-this.y) < 9 && this.pathIndex < this.path.length-1) {
            this.pathIndex++;
            waypoint = this.path[this.pathIndex];
        }
        const targetAngle = Math.atan2(waypoint.y-this.y, waypoint.x-this.x);
        this.angle = lerpAngle(this.angle, targetAngle, turnSpeed, dt);
        const step = speed * dt * 60;
        const vx = Math.cos(this.angle) * step, vy = Math.sin(this.angle) * step;
        const nextX=this.x+vx, nextY=this.y+vy;
        if (!checkTileCollision(nextX,this.y,this.radius)) this.x=nextX;
        if (!checkTileCollision(this.x,nextY,this.radius)) this.y=nextY;
    }

    takeDamage(amount, attackerX, attackerY) {
        this.hp -= amount;
        sfx.guardHit();
        createBloodParticles(this.x, this.y);
        showFloatingText(`-${amount}`, this.x, this.y, "#f59e0b");

        this.state = 'CHASE';
        triggerAlarm();

        if (this.hp <= 0) {
            guardKills++;
            createBloodParticles(this.x, this.y, 25);
        }
    }
}

