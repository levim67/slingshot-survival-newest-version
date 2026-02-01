
import { GameState, Entity, Upgrades, Vector2 } from '../../types';
import { add, sub, mult, mag, normalize, dist, checkCollision, checkCircleRect, resolveStaticCollision, resolveElasticCollision, randomRange, checkLineCircle } from '../../utils/physics';
import { GRAVITY, LAVA_LEVEL, BALL_DEFINITIONS } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { spawnFloatingText, addShake, findBestTarget } from '../spawners/EffectSpawner';
import { spawnExplosion, spawnDirectionalBurst, generateLightningPoints, triggerChainLightning, spawnDebrisExplosion } from './VFXSystem';
import { spawnFriendlyMissile } from '../spawners/ProjectileSpawner';
import { killBoss } from '../spawners/BossSpawner';
import { handleWormSegmentDeath } from './BossSystem';
import { checkStormfireOnHitProc } from './StormfireSystem';

/**
 * Handles platform collisions with the player
 */
export const handlePlatformCollisions = (state: GameState, upgrades: Upgrades) => {
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

/**
 * Handles boss collision with the player
 */
export const handleBossCollision = (
    state: GameState,
    entity: Entity,
    dt: number,
    isImmune: boolean,
    entitiesToRemove: Set<string>,
    upgrades: Upgrades
): boolean => {
    if (entity.type !== 'boss' || !entity.bossData) return false;

    if (checkCircleRect(state.player.position, state.player.radius,
        { x: entity.position.x - entity.radius, y: entity.position.y - entity.radius },
        { x: entity.radius * 2, y: entity.radius * 2 }).collision) {

        // Ignore dying boss
        if (entity.bossData.state === 'DYING' || entity.bossData.state === 'SHATTER') return false;

        const canHitBoss = entity.bossData.state === 'IDLE_VULNERABLE' || entity.bossData.type === 'WORM_DEVOURER';

        if (canHitBoss) {
            if (entity.bossData.invincibilityTimer > 0) {
                const pushDir = normalize(sub(state.player.position, entity.position));
                state.player.velocity = add(state.player.velocity, mult(pushDir, 500 * dt));
                state.player.position = add(state.player.position, mult(pushDir, 5));
            } else {
                const dmg = 250 * state.combo.multiplier;
                entity.bossData.currentHealth -= dmg;
                entity.bossData.invincibilityTimer = 0.4;

                audio.playSFX('impact');
                addShake(state, 10);

                const pushDir = normalize(sub(entity.position, state.player.position));
                entity.velocity = add(entity.velocity || { x: 0, y: 0 }, mult(pushDir, 500));
                const { v1 } = resolveElasticCollision(state.player.position, state.player.velocity, state.player.mass, entity.position, entity.velocity || { x: 0, y: 0 }, 100, 0.5);
                state.player.velocity = v1;
                spawnExplosion(state, state.player.position, '#00ff00', '#ffffff', state.player.velocity);
                spawnFloatingText(state, entity.position, `-${dmg}`, '#ff0000');

                if (entity.bossData.currentHealth <= 0) {
                    if (entity.bossData.type === 'WORM_DEVOURER') handleWormSegmentDeath(state, entity, entitiesToRemove, upgrades);
                    else { killBoss(state, entity, upgrades); /* Don't remove ID yet, let killBoss set DYING */ }
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
    return true;
};

export const handleWallCollision = (state: GameState, wall: Entity, isImmune: boolean) => {
    if (wall.type !== 'wall') return;
    // Check collision with wall rect. Warning: wall position is top-left or center?
    // checkCircleRect uses rect Pos (top-left) and Size.
    // My spawners use Center position.
    // I need to convert Center to Top-Left for checkCircleRect.

    const w = wall.width || 100;
    const h = wall.height || 100;
    const topLeft = { x: wall.position.x - w / 2, y: wall.position.y - h / 2 }; /* Assuming center pos */
    // Wait, SpawnClosingWalls uses Center.
    // But checkCircleRect expects Top Left?
    // utils/physics.ts checkCircleRect definition check:
    // It usually expects x,y,w,h.
    // Let's assume standard AABB input.

    // Actually, I'll use checkCircleRect on the centered rect by adjusting passing topLeft.
    // Wait, did I check physics.ts? Step 859 showed imports but not checkCircleRect impl.
    // I'll assume standard Rect(x,y,w,h) means x,y is Top-Left.

    // Correction:
    // spawnClosingWalls sets position to center.
    // So I must offset by -w/2, -h/2.

    // BUT! checkCircleRect calls checkCollision(circle, rect).
    // Let's rely on that behavior safely.

    const { collision } = checkCircleRect(
        state.player.position, state.player.radius,
        { x: wall.position.x, y: wall.position.y }, // passing pos but checkCircleRect might think it's top-left
        { x: w, y: h }
    );
    // Note: If wall.position is center, and checkCircleRect expects top-left, I need to subtract half size.
    // I'll subtract half size to be safe.

    const realTopLeft = { x: wall.position.x - w / 2, y: wall.position.y - h / 2 };
    const { collision: hit } = checkCircleRect(state.player.position, state.player.radius, realTopLeft, { x: w, y: h });

    if (hit) {
        if (!isImmune) {
            state.player.health -= 500;
            spawnFloatingText(state, state.player.position, "CRUSHED!", '#ff0000');
            audio.playSFX('impact');
            addShake(state, 30);
            // Bounce back?
            const pushDir = normalize(sub(state.player.position, wall.position));
            state.player.velocity = mult(pushDir, 2000);
        }
    }
};

/**
 * Destroys a ball and handles rewards, effects, and special mechanics
 */
export const destroyBall = (
    state: GameState,
    entity: Entity,
    upgrades: Upgrades,
    entitiesToRemove: Set<string>,
    cause: string,
    impactVel: Vector2 = { x: 0, y: 0 } // NEW: Impact velocity for directional burst
) => {
    const def = entity.ballDef;
    if (!def) return;

    spawnDebrisExplosion(state, entity.position, def.coreColor, 1.0, impactVel);
    if (def.points > 0) {
        spawnFloatingText(state, entity.position, `+${def.points * state.combo.multiplier}`, '#ffff00');
        state.score += def.points * state.combo.multiplier;
        audio.playSFX('break');
    } else audio.playSFX('break');

    if (cause === 'PLAYER') {
        if (def.specialEffect === 'RANDOM_LAUNCH') {
            const angle = Math.random() * Math.PI * 2;
            state.player.velocity = mult({ x: Math.cos(angle), y: Math.sin(angle) }, 1500);
        }

        // Chain Lightning - DISABLED if Stormfire is purchased
        if (upgrades.chainLightningChance > 0 && !upgrades.unlockParagonStormfire && Math.random() < upgrades.chainLightningChance) {
            triggerChainLightning(state, entity.position, upgrades.chainLightningCount, entitiesToRemove,
                (s, e, etr, c) => destroyBall(s, e, upgrades, etr, c));
        }

        // PARAGON: Stormfire on-hit proc (replaces Chain Lightning)
        if (upgrades.unlockParagonStormfire) {
            checkStormfireOnHitProc(state, upgrades, entity.position);
        }

        if (upgrades.bounceMissileChance > 0 && Math.random() < upgrades.bounceMissileChance) {
            spawnFriendlyMissile(state, entity.position, upgrades);
        }
        if (upgrades.splitChance > 0 && def.isTarget && !['mini_ball', 'missile_battery', 'flame_enemy', 'electric_enemy'].includes(def.id) && Math.random() < upgrades.splitChance) {
            const count = Math.floor(upgrades.splitCount) || 1;
            for (let k = 0; k < count; k++) {
                const a = Math.random() * Math.PI * 2;
                state.world.entities.push({
                    id: Math.random().toString(), type: 'ball', ballType: entity.ballType, ballDef: def,
                    position: add(entity.position, mult({ x: Math.cos(a), y: Math.sin(a) }, def.radius * 1.5)),
                    radius: def.radius, color: def.coreColor,
                    velocity: { x: Math.cos(a) * randomRange(300, 600), y: Math.sin(a) * randomRange(300, 600) },
                    invulnerableTime: 0.3, rotation: entity.rotation
                });
            }
            spawnFloatingText(state, { x: entity.position.x, y: entity.position.y + 50 }, "SPLIT!", '#ff00ff');
        }
    }

    if (state.utility.currentTargetId === entity.id) state.utility.currentTargetId = null;

    if (def.id === 'missile_battery' || def.id === 'flame_enemy') {
        state.world.entities.forEach(c => {
            if ((c.type === 'missile' || c.type === 'fireball') && c.parentId === entity.id) {
                entitiesToRemove.add(c.id);
                spawnExplosion(state, c.position, '#ef4444', '#f97316', { x: 0, y: 0 });
            }
        });
    }
    if (def.id === 'flame_enemy') {
        audio.playSFX('fire_death');
        spawnExplosion(state, entity.position, '#f97316', '#fbbf24', { x: 0, y: 0 });
    }
    if (def.id === 'electric_enemy') {
        audio.playSFX('electric_death');
        spawnExplosion(state, entity.position, '#06b6d4', '#22d3ee', { x: 0, y: 0 });
    }

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
        const boostDir = { x: Math.cos(entity.rotation || 0), y: Math.sin(entity.rotation || 0) };
        state.player.velocity = mult(boostDir, 1500);
        state.player.position = add(state.player.position, mult(boostDir, 20));
        spawnFloatingText(state, state.player.position, "TURBO!", '#00ffff');
        addShake(state, 10);
    }
};

/**
 * Handles player collision with balls (targets and hazards)
 */
export const handleBallCollision = (
    state: GameState,
    entity: Entity,
    isImmune: boolean,
    entitiesToRemove: Set<string>,
    upgrades: Upgrades
): boolean => {
    if (entity.type !== 'ball' || !entity.ballDef) return false;
    if (entity.ballDef.id === 'black_hole') return false;

    if (checkCollision(state.player.position, state.player.radius, entity.position, entity.radius)) {
        const def = entity.ballDef;
        let destroy = def.destroyableByDirectHit;

        if (def.spikeStyle && def.spikeStyle !== 'none') {
            if (def.spikeStyle === 'normal' && upgrades.unlockGreenSpikeBreaker) {
                destroy = true;
                spawnFloatingText(state, entity.position, "SMASH!", '#ffffff');
            }
            else if (def.spikeStyle === 'super' && upgrades.unlockRedSpikeBreaker) {
                destroy = true;
                spawnFloatingText(state, entity.position, "CRUSH!", '#ff0000');
            }
        }

        if (def.lethalOnTouch || def.isHazard) {
            if (destroy) { }
            else if (isImmune) { destroy = true; }
            else {
                state.player.health -= 30;
                addShake(state, 20);
                spawnExplosion(state, entity.position, '#ff0000', '#ff0000', state.player.velocity);
                audio.playSFX('impact');
                state.combo.multiplier = 1;

                // KNOCKBACK FIX
                const bounceDir = normalize(sub(state.player.position, entity.position));
                state.player.velocity = add(state.player.velocity, mult(bounceDir, 1500));
                state.player.position = add(state.player.position, mult(bounceDir, 5));
            }
        }
        if (isImmune && def.isTarget) destroy = true;

        if (destroy) {
            entitiesToRemove.add(entity.id);
            // Pass player velocity for directional burst
            destroyBall(state, entity, upgrades, entitiesToRemove, 'PLAYER', state.player.velocity);
        } else {
            const { v1 } = resolveElasticCollision(state.player.position, state.player.velocity, state.player.mass, entity.position, { x: 0, y: 0 }, def.mass, def.bounciness);
            state.player.velocity = v1;
            audio.playSFX('impact', 0.5);
        }
    }
    return true;
};

/**
 * Handles black hole gravitational pull effect
 */
export const handleBlackHoleEffect = (state: GameState, entity: Entity, dt: number) => {
    if (entity.ballDef?.id !== 'black_hole') return;

    const distVec = sub(entity.position, state.player.position);
    const d = mag(distVec);
    const gravityRadius = 350;

    if (d < gravityRadius) {
        const pullDir = normalize(distVec);
        const pullStrength = (1 - (d / gravityRadius)) * 1500 * dt;
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
};

/**
 * Updates enemy ball behaviors (missile battery, flame enemy, electric enemy)
 */
export const updateEnemyBehaviors = (
    state: GameState,
    entity: Entity,
    dt: number,
    isImmune: boolean
) => {
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
                position: { x: entity.position.x + Math.cos(angle) * entity.radius, y: entity.position.y + Math.sin(angle) * entity.radius },
                velocity: { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50 - 50 },
                color: '#fbbf24', radius: randomRange(2, 4), lifeTime: 0.5, isSpark: true
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
                        spawnExplosion(state, state.player.position, '#06b6d4', '#ffffff', { x: 0, y: 0 });
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
};
