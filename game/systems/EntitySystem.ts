
import { GameState, Entity, Upgrades } from '../../types';
import { add, mult, mag, normalize, sub, randomRange, dist } from '../../utils/physics';
import { GRAVITY, LAVA_LEVEL } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { addShake } from '../spawners/EffectSpawner';
import { spawnExplosion, spawnDirectionalBurst, spawnFieryExplosion } from './VFXSystem';
import { destroyBall } from './CollisionSystem';
import { handleWormSegmentDeath } from './BossSystem';

/**
 * Explodes a bomb with fiery particle effects and damages nearby entities
 * VFX UPDATE: NO flash, NO shockwave - replaced with fiery embers
 */
export const explodeBomb = (
    state: GameState,
    pos: { x: number; y: number },
    upgrades: Upgrades,
    entitiesToRemove: Set<string>
) => {
    const radius = upgrades.bombRadius;
    addShake(state, 40); // Will be reduced by 90% in addShake function
    audio.playSFX('bomb_explode', 1.0);

    // --- FIERY EXPLOSION (No flash, no shockwave) ---
    spawnFieryExplosion(state, pos, 1.5); // Higher intensity for bombs

    // Damage Logic
    state.world.entities.forEach(e => {
        if (entitiesToRemove.has(e.id)) return;
        if ((e.type === 'ball' && e.ballDef) || (e.type === 'boss')) {
            if (dist(pos, e.position) <= radius) {
                if (e.type === 'boss' && e.bossData) {
                    e.bossData.currentHealth -= 500;
                    state.world.entities.push({
                        id: `text_${Math.random()}`,
                        type: 'floating_text',
                        position: { ...e.position },
                        velocity: { x: 0, y: -100 },
                        color: '#f97316',
                        text: "-500",
                        radius: 20,
                        lifeTime: 0.8
                    });
                    if (e.bossData.currentHealth <= 0) {
                        if (e.bossData.type === 'WORM_DEVOURER') handleWormSegmentDeath(state, e, entitiesToRemove, upgrades);
                        else {
                            entitiesToRemove.add(e.id);
                            // killBoss will be called separately
                        }
                    }
                } else {
                    entitiesToRemove.add(e.id);
                    destroyBall(state, e, upgrades, entitiesToRemove, 'MISSILE');
                }
            }
        }
    });
};

/**
 * Updates lava particles (bubbles and sparks)
 */
export const updateLavaParticles = (state: GameState, dt: number, createLavaParticleFn: (xBase: number) => any) => {
    state.world.lavaParticles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'bubble') {
            p.x += Math.sin(state.visuals.time * 5 + p.y * 0.1) * 20 * dt;
        }
        p.life -= dt;
        if (p.life <= 0) {
            Object.assign(p, createLavaParticleFn(state.camera.position.x));
            p.y = LAVA_LEVEL + randomRange(0, 50);
        }
    });
    if (state.world.lavaParticles.length < 80) {
        state.world.lavaParticles.push(createLavaParticleFn(state.camera.position.x));
    }
};

/**
 * Updates generic particle/effect entities (lifetime, physics, decay)
 */
export const updateGenericEntities = (
    state: GameState,
    entity: Entity,
    dt: number,
    entitiesToRemove: Set<string>
): boolean => {
    // OPTIMIZATION: Aggressive Culling for distant entities (Anti-Lag)
    if (dist(entity.position, state.player.position) > 4000) {
        // Don't cull bosses or walls (structure) immediately, but remove projectiles/particles
        if (entity.type !== 'boss' && entity.type !== 'wall') {
            entitiesToRemove.add(entity.id);
            return false;
        }
    }

    if (entity.type === 'particle' || entity.type === 'debris' || entity.type === 'shockwave' || entity.type === 'floating_text' || entity.type === 'lightning' || entity.type === 'shockwave_ring' || entity.type === 'stormfire_chain' || entity.type === 'wall') {
        if (entity.type === 'particle' || entity.type === 'debris') {
            if (entity.drag) {
                // Framerate-independent drag: scale drag factor by time delta
                const dragFactor = Math.pow(entity.drag, dt * 60);
                entity.velocity = mult(entity.velocity || { x: 0, y: 0 }, dragFactor);
            }
            if (entity.gravity) entity.velocity!.y += GRAVITY * 0.8 * dt;
            if (entity.angularVelocity) entity.rotation = (entity.rotation || 0) + entity.angularVelocity * dt;
            if (entity.scaleDecay) {
                entity.radius *= 0.95;
                entity.scale = (entity.scale || 1) * 0.95;
            }
            if (entity.shape === 'smoke') entity.radius += 20 * dt;
        }
        if (entity.type === 'shockwave') entity.radius += 2500 * dt;
        if (entity.type === 'shockwave_ring') entity.radius += 1000 * dt;

        // PHYSICS UPDATE
        if (entity.velocity) entity.position = add(entity.position, mult(entity.velocity, dt));

        entity.lifeTime = (entity.lifeTime || 1.0) - dt;
        if (entity.lifeTime <= 0 || ((entity.type === 'particle' || entity.type === 'debris') && entity.radius < 0.2)) {
            entitiesToRemove.add(entity.id);
        }
        return true;
    }

    // Handle invulnerable timer on any entity
    if (entity.invulnerableTime && entity.invulnerableTime > 0) {
        entity.invulnerableTime -= dt;
    }

    return false;
};
