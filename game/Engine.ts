
import { GameState, Entity, Upgrades, Vector2, BallTypeId, Platform, LavaParticle } from '../types';
import { add, sub, mult, mag, normalize, dist, randomRange, clamp, checkCollision, checkCircleRect, checkLineCircle, resolveStaticCollision, resolveElasticCollision } from '../utils/physics';
import * as audio from '../utils/audio';
import { GRAVITY, LAVA_LEVEL, CHUNK_SIZE, GENERATION_BUFFER, CONST_DECAY_RATE, BOSS_SPAWN_INTERVAL, BALL_DEFINITIONS } from '../utils/constants';

interface GameCallbacks {
    onGameOver: (score: number) => void;
    onUpdateStats: (health: number, score: number, distance: number, multiplier: number) => void;
    onUpdateHUD: (unlocked: boolean, cooldownRemaining: number, isActive: boolean, timeAlive: number, bossHp: number, maxBossHp: number) => void;
}

export const initializeWorld = (state: GameState) => {
    // Clear existing
    state.world.entities = [];
    state.world.platforms = [];
    state.world.lavaParticles = [];
    
    // Add Start Platform
    state.world.platforms.push({ id: 'start', position: { x: -400, y: 500 }, size: { x: 800, y: 1000 }, type: 'start' });
    
    // Add Initial Lava
    for(let i=0; i<80; i++) state.world.lavaParticles.push(createLavaParticle(0));
    
    // Spawn Initial Entities (Safe Zone -1000 to 1000)
    spawnChunkEntities(state, -1000, 1000);
    
    // Reset Gen Pointers
    state.worldGen.nextRightX = 1000;
    state.worldGen.nextLeftX = -1000;
};

export const updateGame = (state: GameState, dt: number, upgrades: Upgrades, callbacks: GameCallbacks) => {
    // --- TIME SCALE / SLOW MO ---
    const targetScale = state.input.isDragging ? upgrades.slowMoTimeScale : 1.0;
    state.time.scale += (targetScale - state.time.scale) * 10 * dt;
    const gameDt = dt * state.time.scale; // Use this for physics that should be slowed
    
    state.visuals.time += dt; // Real time for shaders
    state.time.aliveDuration += dt; 
    
    // --- BOSS SPAWN ---
    if (!state.boss.active && state.time.aliveDuration >= state.boss.nextSpawnTime) {
        const isWorm = state.boss.cycleCount % 2 === 1;
        if (isWorm) spawnWormBoss(state);
        else spawnCubeBoss(state);
        state.boss.active = true;
    }

    updateWorldGeneration(state);

    // --- COMBO ---
    if (state.combo.multiplier > 1) {
        state.combo.timer -= gameDt;
        if (state.combo.timer <= 0) {
            state.combo.multiplier = 1;
            spawnFloatingText(state, state.player.position, "COMBO LOST", '#ff4444');
        }
    }

    // --- UTILITIES (Missiles/Bombs/Fireballs) ---
    // Passive Missiles
    if (upgrades.missileChanceInterval > 0) {
        state.utility.missileTimer += gameDt;
        const interval = 1.0 / Math.max(0.1, upgrades.missileChanceInterval);
        if (state.utility.missileTimer > interval) {
            state.utility.missileTimer = 0;
            const activeMissiles = state.world.entities.filter(e => e.type === 'friendly_missile' || e.type === 'super_missile').length;
            if (activeMissiles < upgrades.missileCap) spawnFriendlyMissile(state, undefined, upgrades);
        }
    }
    // Auto Bomb
    if (upgrades.bombChance > 0) {
        state.utility.bombTimer += gameDt;
        const interval = 1.0 / Math.max(0.1, upgrades.bombChance);
        if (state.utility.bombTimer > interval) {
            state.utility.bombTimer = 0;
            const target = findBombTarget(state);
            if (target) spawnFriendlyBomb(state, target);
        }
    }
    // Auto Fireball
    if (upgrades.fireballChance > 0) {
        state.utility.fireballTimer += gameDt;
        const interval = 1.0 / Math.max(0.1, upgrades.fireballChance);
        if (state.utility.fireballTimer > interval) {
            state.utility.fireballTimer = 0;
            spawnFriendlyFireball(state);
        }
    }

    // --- AUTO BOUNCE ABILITY ---
    updateAutoBounce(state, dt, gameDt, upgrades);

    // --- HUD CALLBACKS ---
    updateHUD(state, upgrades, callbacks.onUpdateHUD);

    // --- PHYSICS ---
    if (state.utility.autoBounceState !== 'ACTIVE') {
        state.player.velocity.y += GRAVITY * gameDt;
    }
    state.player.position = add(state.player.position, mult(state.player.velocity, gameDt));
    state.player.velocity = mult(state.player.velocity, Math.pow(0.995, gameDt * 60)); 
    
    // --- VFX: PLAYER TRAIL (IMPROVED) ---
    const speed = mag(state.player.velocity);
    // OPTIMIZATION: Only spawn trail if under entity limit (now 1200)
    if (speed > 300 && state.utility.autoBounceState !== 'ACTIVE' && state.world.entities.length < 1200) {
        // High density trail
        const density = Math.min(1.0, speed / 2000); 
        if (Math.random() < 0.6 + density * 0.4) {
            const angle = Math.atan2(state.player.velocity.y, state.player.velocity.x) + Math.PI; 
            const spread = 0.4;
            const isSmoke = Math.random() < 0.3;
            
            state.world.entities.push({
                id: `trail_${Math.random()}`,
                type: 'particle',
                position: sub(state.player.position, mult(normalize(state.player.velocity), 10)), // Spawn slightly behind
                velocity: {
                    x: Math.cos(angle + randomRange(-spread, spread)) * randomRange(50, 150),
                    y: Math.sin(angle + randomRange(-spread, spread)) * randomRange(50, 150)
                },
                color: isSmoke ? 'rgba(255,255,255,0.2)' : 'rgba(100, 200, 255, 0.6)',
                radius: isSmoke ? randomRange(10, 20) : randomRange(4, 8),
                lifeTime: isSmoke ? randomRange(0.3, 0.5) : randomRange(0.1, 0.3), // Reduced lifetime
                scaleDecay: true,
                shape: isSmoke ? 'smoke' : 'circle'
            });
        }
    }

    // --- VFX: CHARGING PARTICLES (Suction Spiral) ---
    if (state.input.isDragging && state.world.entities.length < 1200) {
        if (Math.random() < 0.4) { 
             const angle = randomRange(0, Math.PI * 2);
             const dist = randomRange(60, 120);
             const spawnPos = {
                 x: state.player.position.x + Math.cos(angle) * dist,
                 y: state.player.position.y + Math.sin(angle) * dist
             };
             // Calculate velocity to spiral inward
             const dirToPlayer = normalize(sub(state.player.position, spawnPos));
             const tangent = { x: -dirToPlayer.y, y: dirToPlayer.x }; // Spiral component
             const suctionSpeed = randomRange(200, 400);
             
             // Blend inward suction with slight spiral rotation
             const finalVel = add(mult(dirToPlayer, suctionSpeed), mult(tangent, suctionSpeed * 0.5));

             state.world.entities.push({
                 id: `charge_${Math.random()}`,
                 type: 'particle',
                 position: spawnPos,
                 velocity: finalVel,
                 color: '#22d3ee', // Cyan
                 radius: randomRange(2, 4), // Small, focused
                 lifeTime: (dist / suctionSpeed) * 1.2, 
                 scaleDecay: true, // Shrink as they enter
                 isSpark: true
             });
        }
    }

    // LAVA PARTICLES PHYSICS
    updateLavaParticles(state, gameDt);

    // --- COLLISIONS ---
    handlePlatformCollisions(state, upgrades, callbacks);
    handleEntityUpdates(state, gameDt, upgrades, callbacks);

    // --- PLAYER STATUS ---
    // Lava Damage / Decay
    if (state.player.position.y > LAVA_LEVEL - 10) {
        state.player.health -= (CONST_DECAY_RATE + 40) * gameDt;
        state.player.velocity = mult(state.player.velocity, 0.8);
    } else {
        state.player.health -= (CONST_DECAY_RATE * 2.5) * gameDt;
    }
    
    if (state.player.health < 0) state.player.health = 0;
    
    if (state.player.position.y > LAVA_LEVEL + 100) callbacks.onGameOver(Math.floor(state.score));
    else callbacks.onUpdateStats(state.player.health, Math.floor(state.score), state.distanceRecord, state.combo.multiplier);

    // Camera Shake Decay
    if (state.camera.shake > 0) {
        state.camera.shake -= 30 * gameDt;
        if (state.camera.shake < 0) state.camera.shake = 0;
    }
};

// --- LOGIC HELPERS ---

const updateAutoBounce = (state: GameState, realDt: number, gameDt: number, upgrades: Upgrades) => {
    const util = state.utility;
    const t = clamp((upgrades.autoBounceDuration - 2.0) / 3.0, 0, 1); // rough normalize based on max upgrade
    // Actually use the upgrade value directly if stored in upgrades, or re-calculate
    const duration = upgrades.autoBounceDuration || 2.0; 
    const steering = 8 + (6 * t); // simple scaling

    if (util.autoBounceState === 'ACTIVE') {
        util.activeTimer -= gameDt;
        util.charge = Math.max(0, util.activeTimer / duration);
        audio.updateAudioState(state.time.scale, true);

        util.targetSearchTimer -= realDt;
        if (util.targetSearchTimer <= 0) {
            util.targetSearchTimer = 0.1;
            const target = findBestTarget(state);
            if (target) util.currentTargetId = target.id;
            else {
                util.currentTargetId = null;
                state.player.velocity.y = -500;
            }
        }

        if (util.currentTargetId) {
            const target = state.world.entities.find(e => e.id === util.currentTargetId);
            if (target) {
                const dir = normalize(sub(target.position, state.player.position));
                const autoSpeed = mag(state.player.velocity) < 1500 ? 1500 : mag(state.player.velocity);
                const desired = mult(dir, autoSpeed * 1.25);
                const steerStrength = steering * gameDt;
                const newVelX = state.player.velocity.x + (desired.x - state.player.velocity.x) * steerStrength;
                const newVelY = state.player.velocity.y + (desired.y - state.player.velocity.y) * steerStrength;
                state.player.velocity = { x: newVelX, y: newVelY };
            } else {
                util.currentTargetId = null;
            }
        }

        if (util.activeTimer <= 0) {
            util.autoBounceState = 'OFF';
            util.charge = 0;
            audio.updateAudioState(state.time.scale, false);
            // SAFETY BRAKE: Cap velocity so we don't rocket into death
            const currentSpeed = mag(state.player.velocity);
            const safeSpeed = Math.min(currentSpeed, 600); // Cap at 600
            const safeDir = normalize(state.player.velocity);
            // If going down fast, redirect slightly up
            if (safeDir.y > 0.5) safeDir.y = 0.5; 
            
            state.player.velocity = mult(normalize(safeDir), safeSpeed);
        }
    } else {
        audio.updateGlobalTimeScale(state.time.scale);
    }
};

const updateHUD = (state: GameState, upgrades: Upgrades, callback: GameCallbacks['onUpdateHUD']) => {
    const currentUnlocked = (upgrades.autoBounceDuration > 0); // Hacky check if level > 0
    const currentCharge = state.utility.charge;
    const currentActive = state.utility.autoBounceState === 'ACTIVE';
    const currentTime = Math.floor(state.time.aliveDuration);
    
    let bossHp = 0;
    const allBosses = state.world.entities.filter(e => e.type === 'boss');
    if (allBosses.length > 0) {
        if (allBosses[0].bossData?.type === 'WORM_DEVOURER') {
            bossHp = allBosses.reduce((sum, b) => sum + (b.bossData?.currentHealth || 0), 0);
        } else {
            bossHp = allBosses[0].bossData?.currentHealth || 0;
        }
    } else if (state.boss.active) {
        killBoss(state, null, upgrades); // Boss is active but no entities? Kill it.
    }

    const prevHud = state.utility.lastHudUpdate;
    if (prevHud.unlocked !== currentUnlocked || 
        prevHud.active !== currentActive || 
        Math.abs(prevHud.charge - currentCharge) > 0.01 ||
        prevHud.time !== currentTime ||
        Math.abs(prevHud.bossHp - bossHp) > 10) {
        
        callback(currentUnlocked, currentCharge, currentActive, currentTime, bossHp, state.boss.maxHealth);
        state.utility.lastHudUpdate = { unlocked: currentUnlocked, charge: currentCharge, active: currentActive, time: currentTime, bossHp: bossHp };
    }
};

const handlePlatformCollisions = (state: GameState, upgrades: Upgrades, callbacks: GameCallbacks) => {
    for (const plat of state.world.platforms) {
        if (Math.abs(plat.position.x - state.player.position.x) < 2000) {
            const { collision, normal, depth } = checkCircleRect(state.player.position, state.player.radius, plat.position, plat.size);
            if (collision) {
                state.player.position = add(state.player.position, mult(normal, depth));
                if (normal.y < -0.5) {
                    state.player.onGround = true;
                    state.player.health = upgrades.maxHealth;
                    if (state.combo.multiplier > 1) {
                        state.combo.multiplier = 1;
                        spawnFloatingText(state, state.player.position, "FLOOR HIT", '#cccccc');
                    }
                    state.player.velocity.x *= 0.92; 
                    if (state.player.velocity.y > 0) state.player.velocity.y = 0; 
                } else {
                    state.player.velocity = resolveStaticCollision(state.player.velocity, normal, 0.6);
                    addShake(state, 5); 
                }
            }
        }
    }
};

const updateLavaParticles = (state: GameState, dt: number) => {
    state.world.lavaParticles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'bubble') {
            p.x += Math.sin(state.visuals.time * 5 + p.y * 0.1) * 20 * dt;
        }
        p.life -= dt;
        if (p.life <= 0) {
            Object.assign(p, createLavaParticle(state.camera.position.x));
            p.y = LAVA_LEVEL + randomRange(0, 50);
        }
    });
    if (state.world.lavaParticles.length < 80) {
         state.world.lavaParticles.push(createLavaParticle(state.camera.position.x));
    }
};

export const createLavaParticle = (xBase: number): LavaParticle => {
    const isSpark = Math.random() > 0.6;
    return {
        x: xBase + randomRange(-1000, 1000), 
        y: LAVA_LEVEL + randomRange(0, 300),
        vx: randomRange(-20, 20),
        vy: isSpark ? randomRange(-150, -50) : randomRange(-40, -10),
        life: randomRange(0.5, 3.0),
        maxLife: randomRange(1.0, 4.0),
        type: isSpark ? 'spark' : 'bubble',
        size: isSpark ? randomRange(1, 3) : randomRange(4, 12)
    };
};

// --- ENTITY HANDLING ---

const handleEntityUpdates = (state: GameState, dt: number, upgrades: Upgrades, callbacks: GameCallbacks) => {
    const entitiesToRemove = new Set<string>();
    const activeEntities = state.world.entities.filter(e => Math.abs(e.position.x - state.player.position.x) < 3000);
    const isImmune = state.utility.autoBounceState === 'ACTIVE';

    // Boss AI
    const bossEntities = activeEntities.filter(e => e.type === 'boss');
    if (bossEntities.length > 0) {
        if (bossEntities[0].bossData?.type === 'WORM_DEVOURER') {
            updateWormAI(state, bossEntities, dt);
        } else {
            bossEntities.forEach(b => updateCubeBossAI(state, b, dt));
        }
    }

    for (const entity of activeEntities) {
        // SUPER MISSILE & MINI MISSILE LOGIC
        if (entity.type === 'super_missile' || entity.type === 'mini_super_missile') {
            const isMini = entity.type === 'mini_super_missile';
            const target = findBestTarget(state); // Re-evaluate target
            const speed = isMini ? 1200 : 1000;
            const turnSpeed = isMini ? 8 : 6;

            if (target) {
                const toTarget = sub(target.position, entity.position);
                const desired = mult(normalize(toTarget), speed);
                const steer = mult(sub(desired, entity.velocity || {x:0,y:0}), turnSpeed * dt);
                entity.velocity = add(entity.velocity || {x:0,y:0}, steer);
            }
            
            // Trail Update (Sine wobble)
            if (!entity.trail) entity.trail = [];
            // Optimization: Limit trail length
            if (entity.trail.length < 10) {
                entity.trail.push({...entity.position});
            } else {
                entity.trail.shift();
                entity.trail.push({...entity.position});
            }

            entity.position = add(entity.position, mult(entity.velocity || {x:0,y:0}, dt));
            entity.rotation = Math.atan2(entity.velocity!.y, entity.velocity!.x);
            entity.lifeTime = (entity.lifeTime || 0) - dt;
            
            if (entity.lifeTime <= 0) entitiesToRemove.add(entity.id);

            // Collision
            for (const other of activeEntities) {
                if ((other.type === 'ball' && other.ballDef && other.ballDef.isTarget) || (other.type === 'boss' && other.bossData?.type === 'WORM_DEVOURER')) {
                    if (checkCollision(entity.position, entity.radius, other.position, other.radius)) {
                        entitiesToRemove.add(entity.id);
                        
                        // Hit Effect
                        spawnShockwaveRing(state, entity.position, isMini ? 60 : 150, '#22d3ee');
                        audio.playSFX('super_impact', isMini ? 0.6 : 1.0);

                        // Damage Logic
                        if (other.type === 'boss') {
                            other.bossData!.currentHealth -= isMini ? 100 : 500;
                            spawnFloatingText(state, other.position, isMini ? "-100" : "-500", '#00ffff');
                            if (other.bossData!.currentHealth <= 0) handleWormSegmentDeath(state, other, entitiesToRemove, upgrades);
                        } else {
                            entitiesToRemove.add(other.id);
                            destroyBall(state, other, upgrades, entitiesToRemove, 'MISSILE');
                        }

                        // Split Logic (Only main super missile)
                        if (!isMini) {
                            spawnSuperMissileSplit(state, entity.position, 4);
                        }
                        break;
                    }
                }
            }
            continue;
        }

        // BOMB
        if (entity.type === 'bomb') {
            entity.velocity!.y += GRAVITY * dt;
            entity.position = add(entity.position, mult(entity.velocity!, dt));
            entity.rotation = (entity.rotation || 0) + 10 * dt;
            entity.lifeTime = (entity.lifeTime || 0) - dt;

            // Spark
            if (Math.random() < 0.5 && state.world.entities.length < 1200) {
                const angle = entity.rotation || 0;
                const fuseX = entity.position.x + Math.cos(angle) * 15;
                const fuseY = entity.position.y + Math.sin(angle) * 15;
                state.world.entities.push({
                    id: `fuse_${Math.random()}`, type: 'particle', position: { x: fuseX, y: fuseY },
                    velocity: { x: randomRange(-20, 20), y: randomRange(-50, -10) },
                    color: '#ffff00', radius: 2, lifeTime: 0.2, isSpark: true
                });
            }

            let hit = false;
            for (const other of activeEntities) {
                if (other.id === entity.id) continue;
                if ((other.type === 'ball' && (other.ballDef?.isTarget || other.ballDef?.isHazard)) || other.type === 'boss') {
                    if (checkCollision(entity.position, entity.radius, other.position, other.radius)) {
                        hit = true;
                        break;
                    }
                }
            }

            if (hit || (entity.lifeTime && entity.lifeTime <= 0) || entity.position.y > LAVA_LEVEL) {
                entitiesToRemove.add(entity.id);
                explodeBomb(state, entity.position, upgrades, entitiesToRemove);
            }
            continue;
        }

        // BOSS COLLISION
        if (entity.type === 'boss' && entity.bossData) {
            if (checkCircleRect(state.player.position, state.player.radius, 
                {x: entity.position.x - entity.radius, y: entity.position.y - entity.radius}, 
                {x: entity.radius*2, y: entity.radius*2}).collision) {
                
                const canHitBoss = entity.bossData.state === 'IDLE_VULNERABLE' || entity.bossData.type === 'WORM_DEVOURER'; 
                
                if (canHitBoss) {
                     if (entity.bossData.invincibilityTimer > 0) {
                          const pushDir = normalize(sub(state.player.position, entity.position));
                          state.player.velocity = add(state.player.velocity, mult(pushDir, 500 * dt)); 
                          state.player.position = add(state.player.position, mult(pushDir, 5)); 
                     } else {
                         const dmg = 150 * state.combo.multiplier;
                         entity.bossData.currentHealth -= dmg;
                         entity.bossData.invincibilityTimer = 0.4;
                         
                         audio.playSFX('impact');
                         addShake(state, 10);
                         
                         const pushDir = normalize(sub(entity.position, state.player.position));
                         entity.velocity = add(entity.velocity || {x:0,y:0}, mult(pushDir, 500));
                         const { v1 } = resolveElasticCollision(state.player.position, state.player.velocity, state.player.mass, entity.position, entity.velocity || {x:0,y:0}, 100, 0.5);
                         state.player.velocity = v1;
                         spawnExplosion(state, state.player.position, '#00ff00', '#ffffff', state.player.velocity);
                         spawnFloatingText(state, entity.position, `-${dmg}`, '#ff0000');

                         if (entity.bossData.currentHealth <= 0) {
                             if (entity.bossData.type === 'WORM_DEVOURER') handleWormSegmentDeath(state, entity, entitiesToRemove, upgrades);
                             else { killBoss(state, entity, upgrades); entitiesToRemove.add(entity.id); }
                         }
                     }
                } else {
                     if (!isImmune) {
                         state.player.health -= 40;
                         state.combo.multiplier = 1;
                         audio.playSFX('impact');
                         addShake(state, 20);
                         const bounceDir = normalize(sub(state.player.position, entity.position));
                         state.player.velocity = mult(bounceDir, 1200);
                     }
                }
            }
        }

        // PROJECTILES
        if (entity.type === 'friendly_missile' || entity.type === 'friendly_fireball') {
            const target = findBestTarget(state);
            const isFire = entity.type === 'friendly_fireball';
            const speed = isFire ? 900 : 800;
            const turnSpeed = isFire ? 3 : 5;

            if (target) {
                const toTarget = sub(target.position, entity.position);
                const desired = mult(normalize(toTarget), speed);
                const steer = mult(sub(desired, entity.velocity || {x:0,y:0}), turnSpeed * dt);
                entity.velocity = add(entity.velocity || {x:0,y:0}, steer);
            }
            entity.position = add(entity.position, mult(entity.velocity || {x:0,y:0}, dt));
            entity.rotation = Math.atan2(entity.velocity!.y, entity.velocity!.x);
            entity.lifeTime = (entity.lifeTime || 0) - dt;
            
            // Trail
            if (Math.random() < 0.5 && state.world.entities.length < 1200) {
                 state.world.entities.push({
                     id: `trail_${Math.random()}`, type: 'particle', position: {...entity.position},
                     velocity: mult(normalize(entity.velocity || {x:0,y:0}), -100),
                     color: isFire ? '#f97316' : '#00ffff', radius: randomRange(2, isFire ? 6 : 4), lifeTime: 0.3, scaleDecay: true
                 });
            }
            if (entity.lifeTime <= 0) entitiesToRemove.add(entity.id);
            
            for (const other of activeEntities) {
                if ((other.type === 'ball' && other.ballDef && other.ballDef.isTarget) || (other.type === 'boss' && other.bossData?.type === 'WORM_DEVOURER')) {
                    if (checkCollision(entity.position, entity.radius, other.position, other.radius)) {
                        entitiesToRemove.add(entity.id);
                        if (other.type === 'boss') {
                            other.bossData!.currentHealth -= 200;
                            spawnFloatingText(state, other.position, "-200", '#00ffff');
                            audio.playSFX('break');
                            if (other.bossData!.currentHealth <= 0) handleWormSegmentDeath(state, other, entitiesToRemove, upgrades);
                        } else {
                            entitiesToRemove.add(other.id);
                            destroyBall(state, other, upgrades, entitiesToRemove, 'MISSILE');
                        }
                        break;
                    }
                }
            }
            continue;
        }

        // ENEMY PROJECTILES
        if ((entity.type === 'missile' || entity.type === 'fireball' || entity.type === 'acid_spit') && entity.targetId === 'player') {
            const isFireball = entity.type === 'fireball';
            const isAcid = entity.type === 'acid_spit';
            const toPlayer = sub(state.player.position, entity.position);
            const desired = mult(normalize(toPlayer), isFireball ? 400 : (isAcid ? 300 : 500));
            const currentVel = entity.velocity || {x:0, y:0};
            const steerStrength = isFireball ? 1.5 : (isAcid ? 0.5 : 2.5); 
            const steer = mult(sub(desired, currentVel), steerStrength * dt);
            entity.velocity = add(currentVel, steer);
            
            entity.position = add(entity.position, mult(entity.velocity, dt));
            entity.rotation = Math.atan2(entity.velocity.y, entity.velocity.x);

            if (Math.random() < 0.4 && state.world.entities.length < 1200) {
                 state.world.entities.push({
                     id: `trail_${Math.random()}`, type: 'particle', position: {...entity.position},
                     velocity: mult(normalize(entity.velocity), -100),
                     color: isFireball ? '#ea580c' : (isAcid ? '#a3e635' : '#fdba74'),
                     radius: isFireball ? randomRange(5, 10) : randomRange(2, 5), lifeTime: 0.6, scaleDecay: true
                 });
            }

            if (checkCollision(state.player.position, state.player.radius, entity.position, entity.radius)) {
                if (!isImmune) {
                    state.player.health -= isFireball ? 35 : (isAcid ? 30 : 25);
                    state.combo.multiplier = 1;
                    audio.playSFX('impact');
                    addShake(state, 15);
                    spawnExplosion(state, entity.position, '#ef4444', '#f97316', entity.velocity);
                }
                entitiesToRemove.add(entity.id);
            }
            entity.lifeTime = (entity.lifeTime || 0) - dt;
            if (entity.lifeTime <= 0) entitiesToRemove.add(entity.id);
            continue; 
        }

        // ENEMY UPDATES
        if (entity.ballDef?.id === 'missile_battery') {
             entity.lastAttackTime = (entity.lastAttackTime || 0) - dt;
             if (entity.lastAttackTime <= 0 && dist(state.player.position, entity.position) < 1200) {
                 entity.lastAttackTime = 3.0; 
                 state.world.entities.push({
                     id: `enemy_missile_${Math.random()}`, type: 'missile', parentId: entity.id,
                     position: { ...entity.position }, velocity: { x: 0, y: -200 }, radius: 12,
                     color: '#ef4444', lifeTime: 5.0, targetId: 'player'
                 });
                 spawnFloatingText(state, entity.position, "!", '#ff0000');
                 audio.playSFX('launch', 0.5);
             }
        }
        if (entity.ballDef?.id === 'flame_enemy') {
            entity.lastAttackTime = (entity.lastAttackTime || 0) - dt;
            if (Math.random() < 0.2 && state.world.entities.length < 1200) {
                const angle = randomRange(0, Math.PI * 2);
                state.world.entities.push({
                    id: `flame_spark_${Math.random()}`, type: 'particle',
                    position: { x: entity.position.x + Math.cos(angle)*entity.radius, y: entity.position.y + Math.sin(angle)*entity.radius },
                    velocity: { x: Math.cos(angle)*50, y: Math.sin(angle)*50 - 50 },
                    color: '#fbbf24', radius: randomRange(2,4), lifeTime: 0.5, isSpark: true
                });
            }
            if (entity.lastAttackTime <= 0 && dist(state.player.position, entity.position) < 1000) {
                entity.lastAttackTime = 4.0;
                state.world.entities.push({
                    id: `fireball_${Math.random()}`, type: 'fireball', parentId: entity.id,
                    position: { ...entity.position }, velocity: { x: 0, y: -100 }, radius: 25,
                    color: '#f97316', lifeTime: 6.0, targetId: 'player'
                });
                spawnFloatingText(state, entity.position, "BURN!", '#f97316');
                audio.playSFX('fireball', 0.8);
            }
        }
        if (entity.ballDef?.id === 'electric_enemy') {
            entity.lastAttackTime = (entity.lastAttackTime || 0);
            entity.attackCharge = (entity.attackCharge || 0);
            const inRange = dist(state.player.position, entity.position) < 900;
            if (entity.attackCharge > 0) {
                entity.attackCharge -= dt; 
                if (entity.attackCharge > 0.4) entity.aimPosition = { ...state.player.position };
                if (Math.random() < 0.05) audio.playSFX('electric_charge');
                if (entity.attackCharge <= 0) {
                    entity.attackCharge = 0;
                    entity.lastAttackTime = 3.5; 
                    audio.playSFX('electric_zap', 1.0);
                    audio.playSFX('lightning', 0.5);
                    const targetPos = entity.aimPosition || state.player.position;
                    state.world.entities.push({
                        id: `enemy_lightning_${Math.random()}`, type: 'lightning',
                        points: generateLightningPoints(entity.position, targetPos),
                        lifeTime: 0.2, position: entity.position, radius: 0, color: '#67e8f9'
                    });
                    if (checkLineCircle(entity.position, targetPos, state.player.position, state.player.radius + 15)) {
                        if (!isImmune) {
                            state.player.health -= 45;
                            state.combo.multiplier = 1;
                            audio.playSFX('impact');
                            addShake(state, 25);
                            spawnExplosion(state, state.player.position, '#06b6d4', '#ffffff', {x:0, y:0});
                        }
                    }
                }
            } else {
                entity.lastAttackTime -= dt;
                if (entity.lastAttackTime <= 0 && inRange) {
                    entity.attackCharge = 1.6; 
                    audio.playSFX('electric_charge');
                }
            }
        }
        if (entity.ballDef?.id === 'black_hole') {
             const distVec = sub(entity.position, state.player.position);
             const d = mag(distVec);
             const gravityRadius = 350;
             if (d < gravityRadius) {
                 const pullDir = normalize(distVec);
                 const pullStrength = (1 - (d/gravityRadius)) * 1500 * dt;
                 state.player.velocity = add(state.player.velocity, mult(pullDir, pullStrength));
                 const tangent = { x: -pullDir.y, y: pullDir.x };
                 state.player.velocity = add(state.player.velocity, mult(tangent, 800 * dt));
                 if (d < 50) {
                     const angle = Math.random() * Math.PI * 2;
                     const spitDir = { x: Math.cos(angle), y: Math.sin(angle) };
                     state.player.velocity = mult(spitDir, 2000); 
                     state.player.position = add(entity.position, mult(spitDir, 70)); 
                     spawnDirectionalBurst(state, entity.position, spitDir, 20, 200);
                     audio.playSFX('launch', 0.8);
                     spawnFloatingText(state, entity.position, "WARP!", '#9333ea');
                     addShake(state, 15);
                 }
             }
        }

        // Generic Entity Life
        if (entity.invulnerableTime && entity.invulnerableTime > 0) entity.invulnerableTime -= dt;
        if (entity.type === 'particle' || entity.type === 'shockwave' || entity.type === 'floating_text' || entity.type === 'lightning' || entity.type === 'shockwave_ring') {
            if (entity.type === 'particle') {
                if (entity.drag) entity.velocity = mult(entity.velocity || {x:0, y:0}, entity.drag);
                if (entity.gravity) entity.velocity!.y += GRAVITY * 0.8 * dt; // Gravity effect on particles
                if (entity.angularVelocity) entity.rotation = (entity.rotation || 0) + entity.angularVelocity * dt;
                if (entity.scaleDecay) entity.radius *= 0.95;
                if (entity.shape === 'smoke') entity.radius += 20 * dt; 
            }
            if (entity.type === 'shockwave') entity.radius += 2500 * dt; // EXPLOSIVE expansion
            if (entity.type === 'shockwave_ring') entity.radius += 1000 * dt; // Rapid ring expansion

            if (entity.velocity) entity.position = add(entity.position, mult(entity.velocity, dt));
            entity.lifeTime = (entity.lifeTime || 1.0) - dt;
            if (entity.lifeTime <= 0 || (entity.type === 'particle' && entity.radius < 0.2)) entitiesToRemove.add(entity.id);
            continue;
        }

        // BALL COLLISION
        if (entity.type === 'ball' && entity.ballDef) {
            if (entity.ballDef.id === 'black_hole') continue;
            if (checkCollision(state.player.position, state.player.radius, entity.position, entity.radius)) {
                const def = entity.ballDef;
                let destroy = def.destroyableByDirectHit;
                if (def.spikeStyle && def.spikeStyle !== 'none') {
                    if (def.spikeStyle === 'normal' && upgrades.unlockGreenSpikeBreaker) { destroy = true; spawnFloatingText(state, entity.position, "SMASH!", '#ffffff'); }
                    else if (def.spikeStyle === 'super' && upgrades.unlockRedSpikeBreaker) { destroy = true; spawnFloatingText(state, entity.position, "CRUSH!", '#ff0000'); }
                }
                if (def.lethalOnTouch || def.isHazard) {
                    if (destroy) {}
                    else if (isImmune) { destroy = true; }
                    else {
                        state.player.health -= 30;
                        addShake(state, 20);
                        spawnExplosion(state, entity.position, '#ff0000', '#ff0000', state.player.velocity); 
                        audio.playSFX('impact');
                        state.combo.multiplier = 1; 
                        
                        // KNOCKBACK FIX
                        const bounceDir = normalize(sub(state.player.position, entity.position));
                        // Force a backward velocity to prevent sticking/grinding
                        state.player.velocity = add(state.player.velocity, mult(bounceDir, 1500));
                        // Lift player slightly to avoid ground drag
                        state.player.position = add(state.player.position, mult(bounceDir, 5));
                    }
                }
                if (isImmune && def.isTarget) destroy = true;

                if (destroy) {
                    entitiesToRemove.add(entity.id);
                    destroyBall(state, entity, upgrades, entitiesToRemove, 'PLAYER');
                } else {
                     const { v1 } = resolveElasticCollision(state.player.position, state.player.velocity, state.player.mass, entity.position, {x:0,y:0}, def.mass, def.bounciness);
                     state.player.velocity = v1;
                     audio.playSFX('impact', 0.5);
                }
            }
        }
    }
    state.world.entities = state.world.entities.filter(e => !entitiesToRemove.has(e.id));
};

// --- SPAWNERS & HELPERS ---

const spawnWormBoss = (state: GameState) => {
    const segments = 15; // More segments
    const hpPerSeg = 20000; // MASSIVE HP BUFF
    state.boss.maxHealth = segments * hpPerSeg;
    spawnFloatingText(state, {x: state.player.position.x, y: state.player.position.y - 400}, "WARNING: THE DEVOURER AWAKENS", '#a3e635');
    audio.playSFX('boss_roar');
    const startX = state.player.position.x - 1000;
    const startY = state.player.position.y + 500;
    let prevId: string | undefined = undefined;
    const segs: Entity[] = [];
    for(let i=0; i<segments; i++) {
        const id = `boss_worm_${Math.random()}`;
        const isHead = i===0;
        const isTail = i===segments-1;
        const type = isHead ? 'HEAD' : (isTail ? 'TAIL' : 'BODY');
        segs.push({
            id: id, type: 'boss', position: { x: startX - (i * 60), y: startY + (i * 60) },
            radius: isHead ? 60 : 50, color: isHead ? '#a3e635' : (isTail ? '#3f6212' : '#65a30d'),
            velocity: { x: 400, y: -400 },
            bossData: { type: 'WORM_DEVOURER', maxHealth: hpPerSeg, currentHealth: hpPerSeg, state: 'WORM_CHASE', stateTimer: 0, attackCounter: 0, invincibilityTimer: 0, wormSegmentType: type, wormPrevSegmentId: prevId }
        });
        prevId = id;
    }
    for(let i=0; i<segs.length - 1; i++) { if (segs[i].bossData) segs[i].bossData!.wormNextSegmentId = segs[i+1].id; }
    state.world.entities.push(...segs);
};

const spawnCubeBoss = (state: GameState) => {
    const maxHp = 50000; state.boss.maxHealth = maxHp;
    const spawnY = state.player.position.y - 600;
    spawnFloatingText(state, {x: state.player.position.x, y: spawnY + 200}, "WARNING: CUBE OVERLORD", '#ff0000');
    audio.playSFX('charge'); audio.playSFX('boss_roar');
    state.world.entities.push({
        id: `boss_cube_${Math.random()}`, type: 'boss', position: { x: state.player.position.x, y: spawnY },
        radius: 80, color: '#ffffff', velocity: { x: 0, y: 0 },
        bossData: { type: 'CUBE_OVERLORD', maxHealth: maxHp, currentHealth: maxHp, state: 'SPAWNING', stateTimer: 3.0, attackCounter: 0, subStage: 0, invincibilityTimer: 0 }
    });
};

const updateWormAI = (state: GameState, segments: Entity[], dt: number) => {
    const heads = segments.filter(e => e.bossData?.wormSegmentType === 'HEAD');
    heads.forEach(head => {
        if (!head.bossData) return;
        if (head.bossData.invincibilityTimer > 0) head.bossData.invincibilityTimer -= dt;
        const toPlayer = sub(state.player.position, head.position);
        
        // --- RUBBER BAND CATCHUP ---
        const distToPlayer = mag(toPlayer);
        let moveSpeed = 900;
        let turnSpeed = 4.0;
        
        if (distToPlayer > 1500) {
            moveSpeed = 2500; // Catch up!
            turnSpeed = 8.0;
        }
        if (distToPlayer > 3000) {
            moveSpeed = 4000; // Rocket boost!
            turnSpeed = 15.0;
        }

        const wave = Math.sin(state.visuals.time * 3 + head.id.charCodeAt(0)) * 300;
        const idealDir = normalize(toPlayer);
        const desiredVel = mult(idealDir, moveSpeed);
        desiredVel.y += wave;
        
        const steer = turnSpeed * dt;
        const currentVel = head.velocity || {x:0,y:0};
        head.velocity = { x: currentVel.x + (desiredVel.x - currentVel.x) * steer, y: currentVel.y + (desiredVel.y - currentVel.y) * steer };
        head.rotation = Math.atan2(head.velocity.y, head.velocity.x);
        head.position = add(head.position, mult(head.velocity, dt));
        // More Spit
        if (Math.random() < 0.04) spawnAcidSpit(state, head.position, state.player.position);
    });
    const bodies = segments.filter(e => e.bossData?.wormSegmentType !== 'HEAD');
    bodies.forEach(seg => {
        if (!seg.bossData) return;
        if (seg.bossData.invincibilityTimer > 0) seg.bossData.invincibilityTimer -= dt;
        const leader = segments.find(e => e.id === seg.bossData?.wormPrevSegmentId);
        if (leader) {
            const d = dist(leader.position, seg.position);
            if (d > 55) {
                const dir = normalize(sub(leader.position, seg.position));
                seg.position = add(seg.position, mult(dir, (d - 55) * 10 * dt));
                seg.rotation = Math.atan2(dir.y, dir.x);
            }
        } else {
            seg.velocity = add(seg.velocity || {x:0,y:0}, {x:0, y: GRAVITY * dt});
            seg.position = add(seg.position, mult(seg.velocity || {x:0,y:0}, dt));
        }
        if (Math.random() < 0.002) spawnAcidSpit(state, seg.position, state.player.position);
    });
};

const updateCubeBossAI = (state: GameState, boss: Entity, dt: number) => {
    if (!boss.bossData) return;
    const data = boss.bossData;
    const toPlayer = sub(state.player.position, boss.position);
    const distToPlayer = mag(toPlayer);

    // --- OFF-SCREEN CATCHUP MECHANIC ---
    // If very far, force a movement state and boost speed
    if (distToPlayer > 1500) {
        // Break out of stationary attacks if player ran away
        if (data.state === 'SHOOTING' || data.state === 'FIRE_NOVA' || data.state === 'LIGHTNING_STORM' || data.state === 'ALIGNING') {
            data.state = 'IDLE_VULNERABLE'; 
            data.stateTimer = 2.0; // Give it a moment to chase before trying to attack again
        }
    }

    data.stateTimer -= dt;
    if (data.invincibilityTimer > 0) data.invincibilityTimer -= dt;

    switch(data.state) {
        case 'SPAWNING':
            boss.velocity = {x:0, y: 20};
            if (data.stateTimer <= 0) { data.state = 'ALIGNING'; data.stateTimer = 1.5; }
            break;
        case 'IDLE_VULNERABLE':
            const target = { x: state.player.position.x, y: state.player.position.y - 400 };
            // Dynamic Lerp Speed: 2 is base, increases up to 10 based on distance
            const lerpFactor = distToPlayer > 1000 ? 5 : 2;
            const boost = distToPlayer > 2000 ? 10 : lerpFactor;
            
            boss.position.x += (target.x - boss.position.x) * boost * dt;
            boss.position.y += (target.y - boss.position.y) * boost * dt;
            boss.rotation = (boss.rotation || 0) + 1 * dt;
            if (data.stateTimer <= 0) { data.state = 'ALIGNING'; data.stateTimer = 1.0; audio.playSFX('charge', 0.8); }
            break;
        case 'ALIGNING':
            boss.velocity = {x:0,y:0}; boss.position.x += randomRange(-5,5); boss.position.y += randomRange(-5,5);
            if (data.stateTimer <= 0) {
                const r = Math.random();
                if (r < 0.25) { data.state = 'SHOOTING'; data.stateTimer = 1.2; }
                else if (r < 0.5) { data.state = 'DASHING'; data.stateTimer = 0.8; boss.velocity = mult(normalize(toPlayer), 2200); audio.playSFX('boss_roar', 1.0); }
                else if (r < 0.75) { data.state = 'LIGHTNING_STORM'; data.stateTimer = 0.5; data.subStage = 5; audio.playSFX('electric_charge', 1.0); }
                else { data.state = 'FIRE_NOVA'; data.stateTimer = 1.5; audio.playSFX('charge', 1.0); }
            }
            break;
        case 'DASHING':
            boss.rotation = (boss.rotation || 0) + 15 * dt;
            boss.position = add(boss.position, mult(boss.velocity || {x:0,y:0}, dt));
            if (data.stateTimer <= 0) { boss.velocity = mult(boss.velocity||{x:0,y:0}, 0.1); data.attackCounter++; if(data.attackCounter>=4){data.attackCounter=0;data.state='IDLE_VULNERABLE';data.stateTimer=4.0;}else{data.state='ALIGNING';data.stateTimer=0.5;} }
            break;
        case 'SHOOTING':
            boss.rotation = Math.atan2(toPlayer.y, toPlayer.x);
            if (data.stateTimer <= 0) {
                for(let i=0; i<7; i++) {
                    const a = boss.rotation - 0.6 + (1.2 * (i/6));
                    state.world.entities.push({ id:`boss_m_${Math.random()}`, type:'missile', targetId:'player', position:{...boss.position}, velocity:{x:Math.cos(a)*700, y:Math.sin(a)*700}, radius:15, color:'#ef4444', lifeTime:6.0 });
                }
                audio.playSFX('launch', 1.0); spawnDirectionalBurst(state, boss.position, {x:Math.cos(boss.rotation),y:Math.sin(boss.rotation)}, 20, 300);
                data.attackCounter++; if(data.attackCounter>=4){data.attackCounter=0;data.state='IDLE_VULNERABLE';data.stateTimer=4.0;}else{data.state='ALIGNING';data.stateTimer=0.8;}
            }
            break;
        case 'FIRE_NOVA':
            boss.rotation = (boss.rotation||0)+20*dt;
            if (data.stateTimer <= 0) {
                for(let i=0; i<12; i++) {
                    const a = (Math.PI*2*i)/12;
                    state.world.entities.push({ id:`boss_f_${Math.random()}`, type:'fireball', targetId:'player', position:{...boss.position}, velocity:{x:Math.cos(a)*600, y:Math.sin(a)*600}, radius:20, color:'#f97316', lifeTime:5.0 });
                }
                audio.playSFX('fireball', 1.0); spawnExplosion(state, boss.position, '#f97316', '#fbbf24', {x:0,y:0});
                data.attackCounter++; if(data.attackCounter>=4){data.attackCounter=0;data.state='IDLE_VULNERABLE';data.stateTimer=4.0;}else{data.state='ALIGNING';data.stateTimer=0.8;}
            }
            break;
        case 'LIGHTNING_STORM':
            if (data.stateTimer <= 0) {
                if (data.subStage && data.subStage > 0) {
                    state.world.entities.push({ id:`boss_s_${Math.random()}`, type:'ball', ballType:'electric_enemy', ballDef:BALL_DEFINITIONS['electric_enemy'], position:{x:state.player.position.x+randomRange(-100,100), y:state.player.position.y-400}, radius:1, color:'transparent', velocity:{x:0,y:0}, attackCharge:1.0, lifeTime:2.0, aimPosition:state.player.position });
                    data.subStage--; data.stateTimer = 0.4;
                } else {
                    data.attackCounter++; if(data.attackCounter>=4){data.attackCounter=0;data.state='IDLE_VULNERABLE';data.stateTimer=4.0;}else{data.state='ALIGNING';data.stateTimer=0.8;}
                }
            }
            break;
    }
};

export const spawnDirectionalBurst = (state: GameState, pos: Vector2, dir: Vector2, count: number, forceMagnitude: number = 100) => {
    // OPTIMIZATION: Check entity cap (Increased to 1200)
    if (state.world.entities.length > 1200) return;

    const baseSpread = 0.3; 
    const spread = baseSpread + (forceMagnitude / 300) * 0.5; 
    const baseSpeed = 50;
    const speedScale = 2.0 + (forceMagnitude / 300) * 3.0;
    for(let i=0; i<count; i++) {
        const angle = Math.atan2(dir.y, dir.x) + randomRange(-spread, spread);
        const speed = randomRange(baseSpeed, baseSpeed * 2) * speedScale;
        state.world.entities.push({
            id: Math.random().toString(), type: 'particle', position: {...pos},
            radius: randomRange(3, 8), color: '#ffffff', velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.4, 1.0), shape: 'square', rotation: randomRange(0, Math.PI * 2), angularVelocity: randomRange(-10, 10), drag: 0.92, gravity: false 
        });
    }
};

const explodeBomb = (state: GameState, pos: Vector2, upgrades: Upgrades, entitiesToRemove: Set<string>) => {
    const radius = upgrades.bombRadius;
    addShake(state, 40); audio.playSFX('bomb_explode', 1.0);
    
    // Cap check at 1200
    const isCapped = state.world.entities.length > 1200;

    // 1. Shockwave (Rapid expansion)
    state.world.entities.push({ id: Math.random().toString(), type: 'shockwave', position: {...pos}, radius: radius * 0.5, velocity: {x:0,y:0}, color: '#ffffff', lifeTime: 0.2 });
    
    // 2. Blinding Flash Core
    state.world.entities.push({ id: Math.random().toString(), type: 'particle', position: {...pos}, radius: 120, color: '#fffbeb', lifeTime: 0.1, scaleDecay: true });

    if (!isCapped) {
        // 3. Dense Fireball (Center) - Restored
        for(let i=0; i<40; i++) {
            const a = randomRange(0, Math.PI*2);
            const dist = randomRange(0, 40);
            state.world.entities.push({
                id: Math.random().toString(), type: 'particle', 
                position: { x: pos.x + Math.cos(a)*dist, y: pos.y + Math.sin(a)*dist },
                velocity: { x: 0, y: 0 }, 
                color: Math.random()>0.5 ? '#f59e0b' : '#ef4444', 
                radius: randomRange(40, 70), 
                lifeTime: randomRange(0.4, 0.7),
                scaleDecay: true,
                shape: 'circle'
            });
        }

        // 4. Expanding Debris/Fire - Restored & Chunky
        for(let i=0; i<60; i++) {
            const a = randomRange(0, Math.PI*2); 
            const s = randomRange(100, 600);
            const col = Math.random() > 0.7 ? '#fee2e2' : (Math.random() > 0.4 ? '#fca5a5' : '#ef4444'); 
            state.world.entities.push({ 
                id: Math.random().toString(), type: 'particle', position: pos, 
                velocity: { x: Math.cos(a)*s, y: Math.sin(a)*s }, 
                color: col, radius: randomRange(10, 25), lifeTime: randomRange(0.5, 1.0), 
                scaleDecay: true, drag: 0.9, gravity: true
            });
        }

        // 5. Heavy Smoke Trails - Restored
        for(let i=0; i<40; i++) {
            const a = randomRange(0, Math.PI*2); 
            const s = randomRange(50, 200);
            state.world.entities.push({ 
                id: Math.random().toString(), type: 'particle', shape: 'smoke', 
                position: add(pos, {x:randomRange(-30,30), y:randomRange(-30,30)}), 
                velocity: { x: Math.cos(a)*s, y: Math.sin(a)*s - 100 }, 
                color: '#1f2937', radius: randomRange(30, 60), lifeTime: randomRange(1.5, 2.5) 
            });
        }
    }

    // Logic
    state.world.entities.forEach(e => {
        if (entitiesToRemove.has(e.id)) return;
        if ((e.type === 'ball' && e.ballDef) || (e.type === 'boss')) {
            if (dist(pos, e.position) <= radius) {
                if (e.type === 'boss' && e.bossData) {
                    e.bossData.currentHealth -= 500;
                    spawnFloatingText(state, e.position, "-500", '#f97316');
                    if (e.bossData.currentHealth <= 0) {
                        if (e.bossData.type === 'WORM_DEVOURER') handleWormSegmentDeath(state, e, entitiesToRemove, upgrades);
                        else { entitiesToRemove.add(e.id); killBoss(state, e, upgrades); }
                    }
                } else {
                    entitiesToRemove.add(e.id);
                    // Pass 'MISSILE' so it doesn't charge auto-bounce
                    destroyBall(state, e, upgrades, entitiesToRemove, 'MISSILE'); 
                }
            }
        }
    });
};

const destroyBall = (state: GameState, entity: Entity, upgrades: Upgrades, entitiesToRemove: Set<string>, cause: string) => {
    const def = entity.ballDef; if (!def) return;
    spawnExplosion(state, entity.position, def.coreColor, def.glowColor, state.player.velocity);
    if (def.points > 0) {
        spawnFloatingText(state, entity.position, `+${def.points * state.combo.multiplier}`, '#ffff00');
        state.score += def.points * state.combo.multiplier;
        audio.playSFX('break');
    } else audio.playSFX('break');

    if (cause === 'PLAYER') {
        if (def.specialEffect === 'RANDOM_LAUNCH') {
            const angle = Math.random() * Math.PI * 2;
            state.player.velocity = mult({x:Math.cos(angle), y:Math.sin(angle)}, 1500);
        }
        if (upgrades.chainLightningChance > 0 && Math.random() < upgrades.chainLightningChance) triggerChainLightning(state, entity.position, upgrades.chainLightningCount, entitiesToRemove, upgrades);
        if (upgrades.bounceMissileChance > 0 && Math.random() < upgrades.bounceMissileChance) spawnFriendlyMissile(state, entity.position, upgrades);
        if (upgrades.splitChance > 0 && def.isTarget && !['mini_ball','missile_battery','flame_enemy','electric_enemy'].includes(def.id) && Math.random() < upgrades.splitChance) {
            const count = Math.floor(upgrades.splitCount)||1;
            for(let k=0; k<count; k++) {
                const a = Math.random()*Math.PI*2;
                state.world.entities.push({ id:Math.random().toString(), type:'ball', ballType:entity.ballType, ballDef:def, position:add(entity.position, mult({x:Math.cos(a),y:Math.sin(a)},def.radius*1.5)), radius:def.radius, color:def.coreColor, velocity:{x:Math.cos(a)*randomRange(300,600), y:Math.sin(a)*randomRange(300,600)}, invulnerableTime:0.3, rotation:entity.rotation });
            }
            spawnFloatingText(state, {x:entity.position.x, y:entity.position.y+50}, "SPLIT!", '#ff00ff');
        }
    }
    if (state.utility.currentTargetId === entity.id) state.utility.currentTargetId = null;
    if (def.id === 'missile_battery' || def.id === 'flame_enemy') {
        state.world.entities.forEach(c => { if ((c.type === 'missile' || c.type === 'fireball') && c.parentId === entity.id) { entitiesToRemove.add(c.id); spawnExplosion(state, c.position, '#ef4444', '#f97316', {x:0,y:0}); } });
    }
    if (def.id === 'flame_enemy') { audio.playSFX('fire_death'); spawnExplosion(state, entity.position, '#f97316', '#fbbf24', {x:0,y:0}); }
    if (def.id === 'electric_enemy') { audio.playSFX('electric_death'); spawnExplosion(state, entity.position, '#06b6d4', '#22d3ee', {x:0,y:0}); }
    
    if (def.isTarget) {
        state.combo.multiplier = Math.min(state.combo.multiplier + 1, upgrades.maxComboCap);
        state.combo.timer = 2.5; 
        
        // AUTO-BOUNCE CHARGE: Only if caused by PLAYER
        if (cause === 'PLAYER' && state.utility.autoBounceState === 'OFF') {
            state.utility.charge = Math.min(1.0, state.utility.charge + upgrades.autoBounceChargePerHit);
        }
    }
    
    if (def.fullJuiceRefill) state.player.health = upgrades.maxHealth;
    else if (def.juiceDelta) state.player.health = Math.min(upgrades.maxHealth, state.player.health + def.juiceDelta);
    if (def.specialEffect === 'ARROW_LAUNCH' && cause === 'PLAYER') {
        const boostDir = { x: Math.cos(entity.rotation||0), y: Math.sin(entity.rotation||0) };
        state.player.velocity = mult(boostDir, 1500);
        state.player.position = add(state.player.position, mult(boostDir, 20));
        spawnFloatingText(state, state.player.position, "TURBO!", '#00ffff');
        addShake(state, 10);
    }
};

const spawnFriendlyBomb = (state: GameState, targetPos: Vector2) => {
    const spawnPos = { x: state.player.position.x, y: state.player.position.y - 20 };
    const dx = targetPos.x - spawnPos.x;
    const dy = targetPos.y - spawnPos.y;
    
    // Calculate arc
    const dist = Math.abs(dx);
    const time = clamp(dist / 600, 0.6, 1.2); // Dynamic time based on distance
    
    const vx = dx / time;
    // dy = vy * t + 0.5 * g * t^2 -> vy = (dy - 0.5 * g * t^2) / t
    const vy = (dy - 0.5 * GRAVITY * time * time) / time;

    state.world.entities.push({ 
        id:`bomb_${Math.random()}`, type:'bomb', position:spawnPos, 
        velocity:{x:vx,y:vy}, radius:14, color:'#000000', 
        lifeTime: time + 0.5, // Buffer
        rotation:0 
    });
    audio.playSFX('bomb_throw', 0.6);
};

const spawnFriendlyMissile = (state: GameState, pos?: Vector2, upgrades?: Upgrades) => {
    // PARAGON OVERRIDE
    if (upgrades && upgrades.unlockParagonSuperMissile) {
        spawnSuperMissile(state, pos);
        return;
    }

    const spawnPos = pos ? {...pos} : {...state.player.position};
    if (!pos) spawnPos.y -= 50;
    state.world.entities.push({ id:`friend_m_${Math.random()}`, type:'friendly_missile', position:spawnPos, velocity:{x:randomRange(-200,200),y:-400}, radius:10, color:'#00ffff', lifeTime:4.0 });
    spawnExplosion(state, spawnPos, '#00ffff', '#ffffff', {x:0,y:-100}); audio.playSFX('missile');
};

const spawnSuperMissile = (state: GameState, pos?: Vector2) => {
    const spawnPos = pos ? {...pos} : {...state.player.position};
    if (!pos) spawnPos.y -= 50;
    
    state.world.entities.push({ 
        id:`super_m_${Math.random()}`, 
        type:'super_missile', 
        position:spawnPos, 
        velocity:{x:randomRange(-300,300), y:-500}, 
        radius:16, 
        color:'#22d3ee', 
        lifeTime: 6.0,
        trail: [] 
    });
    
    // Only spawn ring if not capped
    if (state.world.entities.length < 1200) {
        spawnShockwaveRing(state, spawnPos, 80, '#22d3ee');
    }
    audio.playSFX('super_launch');
};

const spawnSuperMissileSplit = (state: GameState, pos: Vector2, count: number) => {
    for(let i=0; i<count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const vel = { x: Math.cos(angle) * 600, y: Math.sin(angle) * 600 };
        state.world.entities.push({
            id: `mini_super_m_${Math.random()}`,
            type: 'mini_super_missile',
            position: { ...pos },
            velocity: vel,
            radius: 8,
            color: '#a5f3fc',
            lifeTime: 2.0,
            trail: []
        });
    }
    audio.playSFX('mini_launch');
};

const spawnShockwaveRing = (state: GameState, pos: Vector2, radius: number, color: string) => {
    // Cap check
    if (state.world.entities.length > 1200) return;
    
    state.world.entities.push({
        id: `shockwave_${Math.random()}`,
        type: 'shockwave_ring',
        position: { ...pos },
        radius: 10, // Starts small
        color: color,
        lifeTime: 0.3,
        velocity: {x:0,y:0}
    });
};

const spawnFriendlyFireball = (state: GameState) => {
    const spawnPos = { x: state.player.position.x, y: state.player.position.y - 80 };
    state.world.entities.push({ id:`friend_f_${Math.random()}`, type:'friendly_fireball', position:spawnPos, velocity:{x:randomRange(-100,100),y:-600}, radius:18, color:'#f97316', lifeTime:5.0 });
    spawnExplosion(state, spawnPos, '#f97316', '#fbbf24', {x:0,y:-100}); audio.playSFX('fireball');
};

const triggerChainLightning = (state: GameState, startPos: Vector2, chainCount: number, entitiesToRemove: Set<string>, upgrades: Upgrades) => {
    let current = startPos;
    let rem = Math.min(20, Math.floor(chainCount));
    const visited = new Set<string>();
    while(rem > 0) {
        let nearest = null; let minD = Infinity;
        for(const e of state.world.entities) {
            if (e.invulnerableTime && e.invulnerableTime>0) continue;
            if (e.type==='ball' && e.ballDef?.isTarget && !entitiesToRemove.has(e.id) && !visited.has(e.id)) {
                const d = dist(current, e.position);
                if (d < 500 && d < minD) { minD = d; nearest = e; }
            }
        }
        if (nearest) {
            visited.add(nearest.id); entitiesToRemove.add(nearest.id);
            state.world.entities.push({ id:`lightning_${Math.random()}`, type:'lightning', points:generateLightningPoints(current, nearest.position), lifeTime:0.3, position:current, radius:0, color:'#00ffff' });
            state.world.entities.push({ id:`flash_${Math.random()}`, type:'particle', position:nearest.position, radius:40, color:'#ffffff', lifeTime:0.1, isSpark:false });
            audio.playSFX('lightning', 0.6);
            destroyBall(state, nearest, upgrades, entitiesToRemove, 'CHAIN');
            current = nearest.position; rem--;
        } else break;
    }
};

const generateLightningPoints = (start: Vector2, end: Vector2): Vector2[] => {
    const points = [start]; const segments = 8; const d = sub(end, start); const len = mag(d); const norm = normalize({x:-d.y, y:d.x});
    for(let i=1; i<segments; i++) {
        const t = i/segments;
        points.push(add(add(start, mult(d, t)), mult(norm, randomRange(-len*0.15, len*0.15))));
    }
    points.push(end);
    return points;
};

// --- FIREWORK EXPLOSION ---
const spawnExplosion = (state: GameState, pos: Vector2, c1: string, c2: string, vel: Vector2) => {
    // Check Cap
    const isCapped = state.world.entities.length > 1200;
    
    // 1. THE FLASH (Immediate bright expansion)
    state.world.entities.push({
        id: Math.random().toString(),
        type: 'particle',
        position: {...pos},
        radius: 60,
        color: '#ffffff',
        lifeTime: 0.1,
        scaleDecay: true,
        shape: 'circle'
    });

    // 2. THE CHUNKS (Geometric debris)
    const chunkCount = isCapped ? 6 : 18;
    for(let i=0; i<chunkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 500);
        // Random shapes
        const shapeType = Math.random() < 0.33 ? 'circle' : (Math.random() < 0.5 ? 'triangle' : 'square');
        
        state.world.entities.push({
            id: Math.random().toString(),
            type: 'particle',
            position: {...pos},
            radius: randomRange(6, 15),
            color: Math.random() > 0.5 ? c1 : c2,
            velocity: { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed },
            lifeTime: randomRange(0.6, 1.2),
            gravity: true,
            drag: 0.96,
            angularVelocity: randomRange(-10, 10),
            shape: shapeType,
            scaleDecay: true
        });
    }

    // 3. THE SPARKS (High speed trails)
    const sparkCount = isCapped ? 10 : 30;
    for(let i=0; i<sparkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(400, 1000);
        state.world.entities.push({
            id: Math.random().toString(),
            type: 'particle',
            position: {...pos},
            radius: randomRange(2, 5),
            color: c2,
            velocity: { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed },
            lifeTime: randomRange(0.3, 0.6),
            isSpark: true,
            drag: 0.9,
            gravity: true
        });
    }
};

// --- IMPLEMENTED MISSING FUNCTIONS ---

export const addShake = (state: GameState, amount: number) => {
    state.camera.shake = Math.min(state.camera.shake + amount, 50);
};

export const spawnFloatingText = (state: GameState, pos: Vector2, text: string, color: string) => {
    state.world.entities.push({
        id: `text_${Math.random()}`,
        type: 'floating_text',
        position: { ...pos },
        velocity: { x: 0, y: -100 },
        color: color,
        text: text,
        radius: 20, 
        lifeTime: 0.8
    });
};

export const findBestTarget = (state: GameState): Entity | null => {
    let best: Entity | null = null;
    let minScore = -Infinity;

    const candidates = state.world.entities.filter(e => 
        (e.type === 'ball' && e.ballDef?.isTarget) || 
        (e.type === 'boss' && (e.bossData?.type === 'CUBE_OVERLORD' || e.bossData?.wormSegmentType === 'HEAD'))
    );

    for (const e of candidates) {
        const d = dist(state.player.position, e.position);
        if (d > 1200) continue;
        
        let score = -d; 
        if (e.type === 'boss') score += 2000; 
        if (e.ballDef?.rarityTag === 'RARE' || e.ballDef?.rarityTag === 'VERY_RARE') score += 500;

        if (score > minScore) {
            minScore = score;
            best = e;
        }
    }
    return best;
};

export const findBombTarget = (state: GameState): Vector2 | null => {
    const candidates = state.world.entities.filter(e => 
        (e.type === 'ball' && (e.ballDef?.isTarget || e.ballDef?.isHazard)) || 
        e.type === 'boss'
    );
    let best = null;
    let minDist = 800;
    
    for(const c of candidates) {
        const d = dist(state.player.position, c.position);
        if (d < minDist) {
            minDist = d;
            best = c.position;
        }
    }
    return best;
};

export const spawnAcidSpit = (state: GameState, pos: Vector2, targetPos: Vector2) => {
    state.world.entities.push({
        id: `acid_${Math.random()}`,
        type: 'acid_spit',
        targetId: 'player',
        position: { ...pos },
        velocity: { x: 0, y: 0 }, 
        radius: 12,
        color: '#a3e635',
        lifeTime: 5.0
    });
};

const pickBallType = (): BallTypeId => {
    const r = Math.random();
    // 55% Common Targets (Increased from 40%)
    if (r < 0.55) return 'red_common';
    // 10% Gold
    if (r < 0.65) return 'gold_rare';
    // 10% Utility
    if (r < 0.75) return 'juice_refill';
    // Hazards (No black spike)
    if (r < 0.83) return 'spike_normal';
    if (r < 0.88) return 'spike_super';
    // Enemies
    if (r < 0.92) return 'missile_battery';
    if (r < 0.95) return 'flame_enemy';
    if (r < 0.98) return 'electric_enemy';
    // Special
    if (r < 0.99) return 'pink_launch'; 
    return 'cash_jackpot';
};

export const spawnChunkEntities = (state: GameState, startX: number, endX: number) => {
    // DENSITY: Approx 1 ball per 100x100 area slice, but vertical is huge.
    // Width = 100 (per step), Height = 5500. Area = 550,000.
    // Need density to not feel empty.
    const count = Math.floor((endX - startX) / 20); // Much higher count
    
    const entitiesToAdd: Entity[] = [];

    for(let i=0; i<count; i++) {
        const typeId = pickBallType();
        const def = BALL_DEFINITIONS[typeId];
        const r = def.radius;
        
        let valid = false;
        let pos = {x:0, y:0};
        let attempts = 0;

        while(!valid && attempts < 15) {
            attempts++;
            pos = {
                x: startX + Math.random() * (endX - startX),
                y: randomRange(-5000, LAVA_LEVEL - 100) // Lower cap to be safe from lava surface
            };

            // 1. Lava Check (Redundant with Y range but safe)
            if (pos.y + r > LAVA_LEVEL - 50) continue;

            // 2. Platform Check
            let hitPlatform = false;
            for(const plat of state.world.platforms) {
                if (checkCircleRect(pos, r + 50, plat.position, plat.size).collision) { // +50 buffer
                    hitPlatform = true;
                    break;
                }
            }
            if (hitPlatform) continue;

            // 3. Entity Overlap Check
            let hitEntity = false;
            // Check currently generating chunk
            for(const e of entitiesToAdd) {
                if (dist(pos, e.position) < r + e.radius + 30) { // Buffer
                    hitEntity = true;
                    break;
                }
            }
            // Check nearby world entities (important for chunk boundaries)
            if (!hitEntity) {
                for(const e of state.world.entities) {
                    // Optimization: spatial filter
                    if (Math.abs(e.position.x - pos.x) < 200) {
                        if (dist(pos, e.position) < r + e.radius + 30) {
                            hitEntity = true;
                            break;
                        }
                    }
                }
            }
            if (hitEntity) continue;

            valid = true;
        }

        if (valid) {
            entitiesToAdd.push({
                id: `gen_${Math.random()}`,
                type: 'ball',
                ballType: typeId,
                ballDef: def,
                position: pos,
                radius: def.radius,
                color: def.coreColor,
                velocity: {x:0, y:0},
                mass: def.mass,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }
    state.world.entities.push(...entitiesToAdd);
};

export const updateWorldGeneration = (state: GameState) => {
    const buffer = GENERATION_BUFFER; 
    if (state.player.position.x + buffer > state.worldGen.nextRightX) {
        spawnChunkEntities(state, state.worldGen.nextRightX, state.worldGen.nextRightX + CHUNK_SIZE);
        state.worldGen.nextRightX += CHUNK_SIZE;
    }
    if (state.player.position.x - buffer < state.worldGen.nextLeftX) {
        spawnChunkEntities(state, state.worldGen.nextLeftX - CHUNK_SIZE, state.worldGen.nextLeftX);
        state.worldGen.nextLeftX -= CHUNK_SIZE;
    }
};

export const killBoss = (state: GameState, bossEntity: Entity | null, upgrades: Upgrades) => {
    state.boss.active = false;
    state.boss.nextSpawnTime = state.time.aliveDuration + BOSS_SPAWN_INTERVAL;
    state.boss.cycleCount++;
    
    // Reward
    state.score += 50000;
    state.player.health = upgrades.maxHealth;
    
    if (bossEntity) {
        spawnExplosion(state, bossEntity.position, '#ffffff', '#ffd700', {x:0,y:0});
        spawnFloatingText(state, bossEntity.position, "BOSS DEFEATED", '#ffd700');
    } else {
        spawnFloatingText(state, state.player.position, "VICTORY", '#ffd700');
    }
};

export const handleWormSegmentDeath = (state: GameState, segment: Entity, entitiesToRemove: Set<string>, upgrades: Upgrades) => {
    spawnExplosion(state, segment.position, '#a3e635', '#3f6212', segment.velocity || {x:0,y:0});
    audio.playSFX('break');
    entitiesToRemove.add(segment.id);

    const prevId = segment.bossData?.wormPrevSegmentId;
    const nextId = segment.bossData?.wormNextSegmentId;

    if (prevId) {
        const prev = state.world.entities.find(e => e.id === prevId);
        if (prev && prev.bossData) prev.bossData.wormNextSegmentId = nextId;
    }
    if (nextId) {
        const next = state.world.entities.find(e => e.id === nextId);
        if (next && next.bossData) {
            next.bossData.wormPrevSegmentId = prevId;
            if (segment.bossData?.wormSegmentType === 'HEAD') {
                next.bossData.wormSegmentType = 'HEAD';
                next.color = '#a3e635'; 
                next.radius = 60;
            }
        }
    }

    const remaining = state.world.entities.filter(e => e.type === 'boss' && e.bossData?.type === 'WORM_DEVOURER' && !entitiesToRemove.has(e.id));
    if (remaining.length <= 1) { 
        killBoss(state, segment, upgrades);
        remaining.forEach(r => entitiesToRemove.add(r.id));
    }
};
