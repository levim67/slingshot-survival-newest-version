/**
 * Stormfire System - PARAGON: Stormfire Attack
 * 
 * Replaces Auto Fireball and Chain Lightning with a combined super attack.
 * Spawns homing Stormfire Lances that chain lightning to nearby enemies on impact.
 */

import { GameState, Upgrades, Entity, Vector2 } from '../../types';
import { add, sub, mult, normalize, mag, dist, randomRange, clamp } from '../../utils/physics';
import * as audio from '../../utils/audio';

// ==========================================
// CONSTANTS
// ==========================================
const STORMFIRE_ICD = 0.45;           // Internal cooldown (seconds)
const STORMFIRE_PROC_CHANCE = 0.12;   // Passive proc chance (12%)
const STORMFIRE_PROC_ON_HIT = 0.10;   // On-hit proc chance (10%)
const STORMFIRE_MAX_ACTIVE = 2;       // Max concurrent lances
const STORMFIRE_CHAIN_COUNT = 5;      // Chain bounces
const STORMFIRE_CHAIN_RADIUS = 450;   // Chain search radius
const STORMFIRE_CHAIN_DELAY = 0.05;   // Delay per chain hop (seconds)
const STORMFIRE_SPEED = 900;          // Projectile speed
const STORMFIRE_TURN_RATE = 50;       // Degrees per second
const STORMFIRE_LIFETIME = 4.0;       // Max lifetime

// ==========================================
// STATE TRACKING
// ==========================================
let activeStormfireCount = 0;

/**
 * Check if Stormfire is on internal cooldown
 */
export const isStormfireOnCooldown = (state: GameState): boolean => {
    return state.utility.stormfireIcdTimer > 0;
};

/**
 * Count active Stormfire lances
 */
export const getActiveStormfireCount = (state: GameState): number => {
    return state.world.entities.filter(e => e.type === 'stormfire_lance').length;
};

/**
 * Find the best target for Stormfire - prioritizes dangerous and high-value targets
 */
export const findStormfireTarget = (state: GameState): Entity | null => {
    const playerPos = state.player.position;
    let bestTarget: Entity | null = null;
    let bestPriority = -1;
    let bestDist = Infinity;

    for (const e of state.world.entities) {
        if (e.invulnerableTime && e.invulnerableTime > 0) continue;

        let priority = 0;

        // Boss - highest priority
        if (e.type === 'boss' && e.bossData && e.bossData.currentHealth > 0) {
            priority = 100;
        }
        // Missile battery - very dangerous
        else if (e.type === 'ball' && e.ballType === 'missile_battery') {
            priority = 80;
        }
        // Super spikes - lethal
        else if (e.type === 'ball' && e.ballType === 'spike_super') {
            priority = 70;
        }
        // Normal spikes - dangerous
        else if (e.type === 'ball' && e.ballType === 'spike_normal') {
            priority = 60;
        }
        // Flame/electric enemies - hazardous
        else if (e.type === 'ball' && (e.ballType === 'flame_enemy' || e.ballType === 'electric_enemy')) {
            priority = 50;
        }
        // Black hole - hazard
        else if (e.type === 'ball' && e.ballType === 'black_hole') {
            priority = 45;
        }
        // Cash targets - high value
        else if (e.type === 'ball' && e.ballDef?.moneyReward && e.ballDef.moneyReward > 0) {
            priority = 40;
        }
        // Regular targets
        else if (e.type === 'ball' && e.ballDef?.isTarget) {
            priority = 20;
        }
        else {
            continue; // Not a valid target
        }

        const d = dist(playerPos, e.position);

        // Pick by priority, then by distance
        if (priority > bestPriority || (priority === bestPriority && d < bestDist)) {
            bestPriority = priority;
            bestDist = d;
            bestTarget = e;
        }
    }

    return bestTarget;
};

/**
 * Spawn a Stormfire Lance projectile
 */
export const spawnStormfireLance = (state: GameState, upgrades: Upgrades, origin?: Vector2): boolean => {
    // Check limits
    if (isStormfireOnCooldown(state)) return false;
    if (getActiveStormfireCount(state) >= STORMFIRE_MAX_ACTIVE) return false;

    const spawnPos = origin ? { ...origin } : { x: state.player.position.x, y: state.player.position.y - 60 };

    // Find target for initial direction
    const target = findStormfireTarget(state);
    let initialVel: Vector2;

    if (target) {
        const dir = normalize(sub(target.position, spawnPos));
        initialVel = mult(dir, STORMFIRE_SPEED);
    } else {
        // No target - fire in player's movement direction or upward
        if (mag(state.player.velocity) > 50) {
            initialVel = mult(normalize(state.player.velocity), STORMFIRE_SPEED);
        } else {
            initialVel = { x: 0, y: -STORMFIRE_SPEED };
        }
    }

    // Create the lance entity
    state.world.entities.push({
        id: `stormfire_${Math.random().toString(36).substr(2, 9)}`,
        type: 'stormfire_lance',
        position: spawnPos,
        velocity: initialVel,
        radius: 12,
        color: '#ffaa00',
        lifeTime: STORMFIRE_LIFETIME,
        maxLifeTime: STORMFIRE_LIFETIME,
        rotation: Math.atan2(initialVel.y, initialVel.x),
        trail: []
    });

    // Set ICD
    state.utility.stormfireIcdTimer = STORMFIRE_ICD;

    // Launch VFX
    spawnStormfireLaunchVFX(state, spawnPos);
    audio.playSFX('super_launch', 0.7);

    return true;
};

/**
 * Spawn launch VFX for Stormfire
 */
const spawnStormfireLaunchVFX = (state: GameState, pos: Vector2) => {
    // Orange/white spark burst
    const count = 8;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + randomRange(-0.2, 0.2);
        const speed = randomRange(200, 400);
        state.world.entities.push({
            id: `sf_spark_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: randomRange(3, 6),
            color: i % 2 === 0 ? '#ffffff' : '#ff6600',
            lifeTime: randomRange(0.15, 0.3),
            drag: 4,
            isSpark: true
        });
    }
};

/**
 * Update Stormfire Lance - homing behavior and trail
 */
export const updateStormfireLance = (
    entity: Entity,
    state: GameState,
    dt: number,
    upgrades: Upgrades,
    entitiesToRemove: Set<string>
): void => {
    if (!entity.velocity) return;

    // Update lifetime
    entity.lifeTime = (entity.lifeTime || 0) - dt;
    if (entity.lifeTime <= 0) {
        entitiesToRemove.add(entity.id);
        spawnEmberShards(state, entity.position, 4);
        return;
    }

    // Update trail
    if (!entity.trail) entity.trail = [];
    entity.trail.unshift({ ...entity.position });
    if (entity.trail.length > 12) entity.trail.pop();

    // Homing behavior
    const target = findStormfireTarget(state);
    if (target) {
        const targetDir = normalize(sub(target.position, entity.position));
        const currentDir = normalize(entity.velocity);

        // Calculate turn
        const turnRateRad = (STORMFIRE_TURN_RATE * Math.PI / 180) * dt;
        const cross = currentDir.x * targetDir.y - currentDir.y * targetDir.x;
        const dot = currentDir.x * targetDir.x + currentDir.y * targetDir.y;

        let angle = Math.atan2(entity.velocity.y, entity.velocity.x);

        if (cross > 0) {
            angle += Math.min(turnRateRad, Math.acos(clamp(dot, -1, 1)));
        } else if (cross < 0) {
            angle -= Math.min(turnRateRad, Math.acos(clamp(dot, -1, 1)));
        }

        entity.velocity = { x: Math.cos(angle) * STORMFIRE_SPEED, y: Math.sin(angle) * STORMFIRE_SPEED };
        entity.rotation = angle;
    }

    // Move
    entity.position = add(entity.position, mult(entity.velocity, dt));

    // Check collisions with targets
    for (const other of state.world.entities) {
        if (other.id === entity.id) continue;
        if (entitiesToRemove.has(other.id)) continue;

        // Check boss collision
        if (other.type === 'boss' && other.bossData) {
            const d = dist(entity.position, other.position);
            if (d < entity.radius + other.radius) {
                onStormfireImpact(entity, other, state, upgrades, entitiesToRemove);
                entitiesToRemove.add(entity.id);
                return;
            }
        }

        // Check ball collision
        if (other.type === 'ball' && other.ballDef) {
            const d = dist(entity.position, other.position);
            if (d < entity.radius + other.radius) {
                onStormfireImpact(entity, other, state, upgrades, entitiesToRemove);
                entitiesToRemove.add(entity.id);
                return;
            }
        }
    }
};

/**
 * Handle Stormfire impact - damage target and trigger chain lightning
 */
export const onStormfireImpact = (
    projectile: Entity,
    target: Entity,
    state: GameState,
    upgrades: Upgrades,
    entitiesToRemove: Set<string>
): void => {
    const impactPos = target.position;

    // Handle boss damage
    if (target.type === 'boss' && target.bossData) {
        const damage = 15; // Strong hit
        target.bossData.currentHealth -= damage;
        target.bossData.invincibilityTimer = 0.1;
        audio.playSFX('impact', 0.8);

        // Impact VFX
        spawnStormfireImpactVFX(state, impactPos, target.color);
    }
    // Handle ball destruction - will be handled by destroyBall in collision system
    else if (target.type === 'ball') {
        entitiesToRemove.add(target.id);
        // Impact VFX
        spawnStormfireImpactVFX(state, impactPos, target.color);
    }

    // Trigger chain lightning from impact point
    triggerStormfireChain(state, impactPos, STORMFIRE_CHAIN_COUNT, entitiesToRemove);

    // Spawn ember shards at final position
    spawnEmberShards(state, impactPos, 8);

    audio.playSFX('lightning', 0.9);
};

/**
 * Trigger Stormfire chain lightning effect
 */
export const triggerStormfireChain = (
    state: GameState,
    startPos: Vector2,
    chainCount: number,
    entitiesToRemove: Set<string>
): void => {
    let current = startPos;
    let remaining = Math.min(chainCount, 10); // Hard cap
    const visited = new Set<string>();

    while (remaining > 0) {
        let nearest: Entity | null = null;
        let minDist = Infinity;

        // Find nearest valid target
        for (const e of state.world.entities) {
            if (e.invulnerableTime && e.invulnerableTime > 0) continue;
            if (entitiesToRemove.has(e.id)) continue;
            if (visited.has(e.id)) continue;

            // Only chain to balls that are targets
            if (e.type === 'ball' && e.ballDef?.isTarget) {
                const d = dist(current, e.position);
                if (d < STORMFIRE_CHAIN_RADIUS && d < minDist) {
                    minDist = d;
                    nearest = e;
                }
            }
        }

        if (nearest) {
            visited.add(nearest.id);
            entitiesToRemove.add(nearest.id);

            // Create lightning arc visual
            state.world.entities.push({
                id: `sf_chain_${Math.random().toString(36).substr(2, 9)}`,
                type: 'stormfire_chain',
                position: current,
                points: generateStormfireArc(current, nearest.position),
                radius: 0,
                color: '#00ffff',
                lifeTime: 0.25
            });

            // Small impact burst
            spawnChainHitVFX(state, nearest.position, nearest.color);

            audio.playSFX('lightning', 0.4);

            current = nearest.position;
            remaining--;
        } else {
            break; // No more valid targets
        }
    }
};

/**
 * Generate jagged arc points for chain lightning
 */
const generateStormfireArc = (start: Vector2, end: Vector2): Vector2[] => {
    const points: Vector2[] = [{ ...start }];
    const segments = 6;
    const dx = (end.x - start.x) / segments;
    const dy = (end.y - start.y) / segments;

    for (let i = 1; i < segments; i++) {
        const jitter = mag({ x: dx, y: dy }) * 0.15;
        points.push({
            x: start.x + dx * i + randomRange(-jitter, jitter),
            y: start.y + dy * i + randomRange(-jitter, jitter)
        });
    }

    points.push({ ...end });
    return points;
};

/**
 * Spawn impact VFX - chunky directional pieces
 */
const spawnStormfireImpactVFX = (state: GameState, pos: Vector2, targetColor: string) => {
    // Directional shards
    const shardCount = 6;
    for (let i = 0; i < shardCount; i++) {
        const angle = (Math.PI * 2 * i) / shardCount + randomRange(-0.3, 0.3);
        const speed = randomRange(150, 350);
        state.world.entities.push({
            id: `sf_shard_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: randomRange(4, 8),
            color: targetColor,
            lifeTime: randomRange(0.3, 0.5),
            drag: 3,
            gravity: true,
            shape: 'square'
        });
    }

    // Electric snap particles (zig-zag)
    for (let i = 0; i < 4; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 200);
        state.world.entities.push({
            id: `sf_snap_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: randomRange(2, 4),
            color: '#00ffff',
            lifeTime: randomRange(0.1, 0.2),
            isSpark: true
        });
    }
};

/**
 * Spawn small VFX for chain hit
 */
const spawnChainHitVFX = (state: GameState, pos: Vector2, targetColor: string) => {
    const count = 3;
    for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(80, 150);
        state.world.entities.push({
            id: `sf_chain_hit_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: randomRange(3, 5),
            color: i === 0 ? '#00ffff' : targetColor,
            lifeTime: randomRange(0.15, 0.25),
            drag: 5,
            isSpark: true
        });
    }
};

/**
 * Spawn ember shards - lingering effect after impact
 */
export const spawnEmberShards = (state: GameState, pos: Vector2, count: number = 6): void => {
    const actualCount = Math.min(count, 10); // Cap for performance

    for (let i = 0; i < actualCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(60, 180);
        state.world.entities.push({
            id: `ember_${Math.random()}`,
            type: 'particle',
            position: { x: pos.x + randomRange(-10, 10), y: pos.y + randomRange(-10, 10) },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 50 },
            radius: randomRange(2, 5),
            color: i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#ffaa00' : '#ff6600'),
            lifeTime: randomRange(0.4, 0.6),
            drag: 5,
            gravity: true,
            scaleDecay: true
        });
    }
};

/**
 * Update passive Stormfire proc (replaces Auto Fireball)
 */
export const updateStormfirePassive = (state: GameState, gameDt: number, upgrades: Upgrades): void => {
    if (!upgrades.unlockParagonStormfire) return;

    // Update ICD timer
    if (state.utility.stormfireIcdTimer > 0) {
        state.utility.stormfireIcdTimer -= gameDt;
    }

    // Passive timer
    state.utility.stormfireTimer += gameDt;

    // Check proc every 0.5 seconds (similar to fireball timing)
    if (state.utility.stormfireTimer >= 0.5) {
        state.utility.stormfireTimer = 0;

        if (Math.random() < STORMFIRE_PROC_CHANCE) {
            spawnStormfireLance(state, upgrades);
        }
    }
};

/**
 * Check for on-hit Stormfire proc (replaces Chain Lightning)
 * Call this when player destroys a target
 */
export const checkStormfireOnHitProc = (state: GameState, upgrades: Upgrades, hitPos: Vector2): boolean => {
    if (!upgrades.unlockParagonStormfire) return false;
    if (isStormfireOnCooldown(state)) return false;

    if (Math.random() < STORMFIRE_PROC_ON_HIT) {
        return spawnStormfireLance(state, upgrades, hitPos);
    }

    return false;
};
