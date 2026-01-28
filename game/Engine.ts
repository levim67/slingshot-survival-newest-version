
/**
 * Slingshot Survival - Game Engine
 * 
 * This is the main orchestrator that coordinates all game systems.
 * Individual system logic has been extracted to modular files.
 */

import { GameState, Entity, Upgrades, Vector2, LavaParticle } from '../types';
import { add, sub, mult, mag, normalize, randomRange } from '../utils/physics';
import * as audio from '../utils/audio';
import { GRAVITY, LAVA_LEVEL, CONST_DECAY_RATE, BOSS_SPAWN_INTERVAL } from '../utils/constants';

// Systems
import { updateAutoBounce, updateCombo, updatePassiveAbilities, updateHUD } from './systems/AbilitySystem';
import { updateCubeBossAI, updateWormAI, handleWormSegmentDeath, updateTriangleBossAI } from './systems/BossSystem';
import {
    handlePlatformCollisions,
    handleBossCollision,
    handleBallCollision,
    handleBlackHoleEffect,
    updateEnemyBehaviors,
    destroyBall,
    handleWallCollision
} from './systems/CollisionSystem';
import { updateFriendlyProjectiles, updateEnemyProjectiles, updateBomb } from './systems/ProjectileSystem';
import { updateGenericEntities, updateLavaParticles, explodeBomb } from './systems/EntitySystem';
import { spawnDirectionalBurst } from './systems/VFXSystem';

// Spawners
import { initializeWorld, updateWorldGeneration, createLavaParticle, spawnChunkEntities } from './spawners/EntitySpawner';
import { spawnCubeBoss, spawnWormBoss, spawnTriangleBoss, killBoss } from './spawners/BossSpawner';
import { spawnFloatingText, addShake, findBestTarget, findBombTarget } from './spawners/EffectSpawner';

// Re-export for external consumers
export { initializeWorld, createLavaParticle, spawnDirectionalBurst, spawnChunkEntities, updateWorldGeneration };
export { addShake, spawnFloatingText, findBestTarget, findBombTarget };
export { killBoss };

interface GameCallbacks {
    onGameOver: (score: number) => void;
    onUpdateStats: (health: number, score: number, distance: number, multiplier: number) => void;
    onUpdateHUD: (unlocked: boolean, cooldownRemaining: number, isActive: boolean, timeAlive: number, bossHp: number, maxBossHp: number) => void;
}

/**
 * Main game update loop - orchestrates all systems
 */
export const updateGame = (state: GameState, dt: number, upgrades: Upgrades, callbacks: GameCallbacks) => {
    // --- TIME SCALE / SLOW MO ---
    // --- TIME SCALE / SLOW MO ---
    const dyingBoss = state.world.entities.find(e => e.type === 'boss' && e.bossData?.state === 'DYING');

    if (dyingBoss) {
        // Cinematic Slow Mo
        state.time.scale += (0.15 - state.time.scale) * 5 * dt;
    } else {
        // Normal Gameplay / Drag Slow Mo
        const targetScale = state.input.isDragging ? upgrades.slowMoTimeScale : 1.0;
        state.time.scale += (targetScale - state.time.scale) * 10 * dt;
    }
    const gameDt = dt * state.time.scale;

    state.visuals.time += dt;
    state.time.aliveDuration += dt;

    // --- BOSS SPAWN ---
    if (!state.boss.active && state.time.aliveDuration >= state.boss.nextSpawnTime) {
        const cycle = state.boss.cycleCount % 3;
        if (cycle === 0) spawnCubeBoss(state);
        else if (cycle === 1) spawnWormBoss(state);
        else spawnTriangleBoss(state);
        state.boss.active = true;
    }

    // --- WORLD GENERATION ---
    updateWorldGeneration(state);

    // --- COMBO DECAY ---
    updateCombo(state, gameDt);

    // --- PASSIVE ABILITIES (Missiles/Bombs/Fireballs) ---
    updatePassiveAbilities(state, gameDt, upgrades);

    // --- AUTO BOUNCE ABILITY ---
    updateAutoBounce(state, dt, gameDt, upgrades);

    // --- HUD CALLBACKS ---
    updateHUD(state, upgrades, callbacks.onUpdateHUD);

    // --- PLAYER PHYSICS ---
    if (state.utility.autoBounceState !== 'ACTIVE') {
        state.player.velocity.y += GRAVITY * gameDt;
    }
    state.player.position = add(state.player.position, mult(state.player.velocity, gameDt));
    state.player.velocity = mult(state.player.velocity, Math.pow(0.995, gameDt * 60));

    // --- VFX: ENHANCED PLAYER TRAIL ---
    const speed = mag(state.player.velocity);
    if (speed > 200 && state.utility.autoBounceState !== 'ACTIVE' && state.world.entities.length < 1200) {
        const density = Math.min(1.0, speed / 2000);
        const angle = Math.atan2(state.player.velocity.y, state.player.velocity.x) + Math.PI;

        // === LAYER 1: Core Energy Particles (Bright, Fast-fading) ===
        if (Math.random() < 0.4 + density * 0.5) {
            const spread = 0.3;
            // Color shifts from cyan to white based on speed
            const speedHue = Math.min(200, 180 + speed / 20); // Cyan to blue-white shift
            const coreColors = [`hsl(${speedHue}, 100%, 80%)`, `hsl(${speedHue}, 100%, 90%)`, '#ffffff'];

            state.world.entities.push({
                id: `trail_core_${Math.random()}`,
                type: 'particle',
                position: sub(state.player.position, mult(normalize(state.player.velocity), 15)),
                velocity: {
                    x: Math.cos(angle + randomRange(-spread, spread)) * randomRange(80, 200),
                    y: Math.sin(angle + randomRange(-spread, spread)) * randomRange(80, 200)
                },
                color: coreColors[Math.floor(Math.random() * coreColors.length)],
                radius: randomRange(3, 6),
                lifeTime: randomRange(0.15, 0.3),
                scaleDecay: true,
                isSpark: true
            });
        }

        // === LAYER 2: Glowing Plasma Wisps (Medium-sized, ethereal) ===
        if (Math.random() < 0.25 + density * 0.25) {
            const spread = 0.6;
            // Cool purple/blue/cyan gradient
            const wispColors = ['rgba(139, 92, 246, 0.6)', 'rgba(59, 130, 246, 0.5)', 'rgba(34, 211, 238, 0.5)'];

            state.world.entities.push({
                id: `trail_wisp_${Math.random()}`,
                type: 'particle',
                position: sub(state.player.position, mult(normalize(state.player.velocity), randomRange(5, 20))),
                velocity: {
                    x: Math.cos(angle + randomRange(-spread, spread)) * randomRange(30, 100),
                    y: Math.sin(angle + randomRange(-spread, spread)) * randomRange(30, 100) - 20 // Slightly float up
                },
                color: wispColors[Math.floor(Math.random() * wispColors.length)],
                radius: randomRange(8, 15),
                lifeTime: randomRange(0.3, 0.5),
                scaleDecay: true,
                shape: 'smoke'
            });
        }

        // === LAYER 3: Sparkle Dust (Tiny, scattered, long-lasting) ===
        if (Math.random() < 0.3 + density * 0.4) {
            const sparkleAngle = randomRange(0, Math.PI * 2);
            const sparkleOffset = randomRange(5, 25);

            state.world.entities.push({
                id: `trail_sparkle_${Math.random()}`,
                type: 'particle',
                position: {
                    x: state.player.position.x + Math.cos(sparkleAngle) * sparkleOffset,
                    y: state.player.position.y + Math.sin(sparkleAngle) * sparkleOffset
                },
                velocity: {
                    x: randomRange(-30, 30),
                    y: randomRange(-30, 30) - 15 // Float up slowly
                },
                color: speed > 800 ? '#fef08a' : '#67e8f9', // Yellow when fast, cyan when slower
                radius: randomRange(1.5, 3),
                lifeTime: randomRange(0.4, 0.8),
                scaleDecay: true,
                isSpark: true
            });
        }

        // === LAYER 4: Speed Lines (At very high speed only) ===
        if (speed > 1200 && Math.random() < 0.15) {
            state.world.entities.push({
                id: `trail_streak_${Math.random()}`,
                type: 'particle',
                position: sub(state.player.position, mult(normalize(state.player.velocity), 25)),
                velocity: mult(state.player.velocity, -0.3),
                color: 'rgba(255, 255, 255, 0.8)',
                radius: randomRange(2, 4),
                lifeTime: randomRange(0.08, 0.15),
                scaleDecay: true,
                shape: 'wedge'
            });
        }
    }

    // --- VFX: CHARGING PARTICLES ---
    if (state.input.isDragging && state.world.entities.length < 1200) {
        if (Math.random() < 0.4) {
            const angle = randomRange(0, Math.PI * 2);
            const dist = randomRange(60, 120);
            const spawnPos = {
                x: state.player.position.x + Math.cos(angle) * dist,
                y: state.player.position.y + Math.sin(angle) * dist
            };
            const dirToPlayer = normalize(sub(state.player.position, spawnPos));
            const tangent = { x: -dirToPlayer.y, y: dirToPlayer.x };
            const suctionSpeed = randomRange(200, 400);
            const finalVel = add(mult(dirToPlayer, suctionSpeed), mult(tangent, suctionSpeed * 0.5));

            state.world.entities.push({
                id: `charge_${Math.random()}`,
                type: 'particle',
                position: spawnPos,
                velocity: finalVel,
                color: '#22d3ee',
                radius: randomRange(2, 4),
                lifeTime: (dist / suctionSpeed) * 1.2,
                scaleDecay: true,
                isSpark: true
            });
        }
    }

    // --- LAVA PARTICLES ---
    updateLavaParticles(state, gameDt, createLavaParticle);

    // --- PLATFORM COLLISIONS ---
    handlePlatformCollisions(state, upgrades);

    // --- ENTITY UPDATES ---
    handleEntityUpdates(state, dt, gameDt, upgrades, callbacks);

    // --- PLAYER STATUS ---
    if (state.player.position.y > LAVA_LEVEL - 10) {
        state.player.health -= (CONST_DECAY_RATE + 40) * gameDt;
        state.player.velocity = mult(state.player.velocity, 0.8);
    } else {
        state.player.health -= (CONST_DECAY_RATE * 2.5) * gameDt;
    }

    if (state.player.health < 0) state.player.health = 0;

    if (state.player.position.y > LAVA_LEVEL + 100) callbacks.onGameOver(Math.floor(state.score));
    else callbacks.onUpdateStats(state.player.health, Math.floor(state.score), state.distanceRecord, state.combo.multiplier);

    // --- CAMERA SHAKE ---
    if (state.camera.shake > 0) {
        state.camera.shake -= 30 * gameDt;
        if (state.camera.shake < 0) state.camera.shake = 0;
    }
};

/**
 * Handles all entity updates - boss AI, projectiles, collisions
 * @param realDt - Actual time delta from requestAnimationFrame (for boss death timers)
 * @param gameDt - Scaled time delta for gameplay physics
 */
const handleEntityUpdates = (state: GameState, realDt: number, gameDt: number, upgrades: Upgrades, callbacks: GameCallbacks) => {
    const entitiesToRemove = new Set<string>();
    const activeEntities = state.world.entities.filter(e => Math.abs(e.position.x - state.player.position.x) < 3000);
    const isImmune = state.utility.autoBounceState === 'ACTIVE';

    // Boss AI - uses realDt so death timers work correctly during slow-mo
    const bossEntities = activeEntities.filter(e => e.type === 'boss');
    if (bossEntities.length > 0) {
        if (bossEntities[0].bossData?.type === 'WORM_DEVOURER') {
            updateWormAI(state, bossEntities, realDt);
        } else {
            bossEntities.forEach(b => {
                if (b.bossData?.type === 'TRIANGLE_ARCHITECT') updateTriangleBossAI(state, b, realDt);
                else updateCubeBossAI(state, b, realDt);
            });
        }
    }

    for (const entity of activeEntities) {
        // Super missiles and friendly projectiles
        if (updateFriendlyProjectiles(state, entity, gameDt, activeEntities, entitiesToRemove, upgrades, destroyBall)) continue;

        // Bombs
        if (updateBomb(state, entity, gameDt, activeEntities, entitiesToRemove, explodeBomb, upgrades)) continue;

        // Boss collision with player
        handleBossCollision(state, entity, gameDt, isImmune, entitiesToRemove, upgrades);

        // Enemy projectiles
        if (updateEnemyProjectiles(state, entity, gameDt, isImmune, entitiesToRemove)) continue;

        // Enemy behaviors (missile battery, flame enemy, electric enemy)
        updateEnemyBehaviors(state, entity, gameDt, isImmune);

        // Black hole effect
        handleBlackHoleEffect(state, entity, gameDt);

        // Generic entity physics and lifetime
        if (updateGenericEntities(state, entity, gameDt, entitiesToRemove)) continue;

        // Ball collision with player
        handleBallCollision(state, entity, isImmune, entitiesToRemove, upgrades);

        // Wall Collision
        if (entity.type === 'wall') handleWallCollision(state, entity, isImmune);
    }

    state.world.entities = state.world.entities.filter(e => !entitiesToRemove.has(e.id));
};
