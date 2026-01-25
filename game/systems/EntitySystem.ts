
import { GameState, Entity, Upgrades } from '../../types';
import { add, mult, mag, normalize, sub, randomRange, dist } from '../../utils/physics';
import { GRAVITY, LAVA_LEVEL } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { addShake } from '../spawners/EffectSpawner';
import { spawnExplosion, spawnDirectionalBurst } from './VFXSystem';
import { destroyBall } from './CollisionSystem';
import { handleWormSegmentDeath } from './BossSystem';

/**
 * Explodes a bomb with massive particle effects and damages nearby entities
 */
export const explodeBomb = (
    state: GameState,
    pos: { x: number; y: number },
    upgrades: Upgrades,
    entitiesToRemove: Set<string>
) => {
    const radius = upgrades.bombRadius;
    addShake(state, 40);
    audio.playSFX('bomb_explode', 1.0);

    const isCapped = state.world.entities.length > 1200;

    // 1. Shockwave (Rapid expansion)
    state.world.entities.push({
        id: Math.random().toString(), type: 'shockwave',
        position: { ...pos }, radius: radius * 0.5, velocity: { x: 0, y: 0 }, color: '#ffffff', lifeTime: 0.2
    });

    // 2. Blinding Flash Core
    state.world.entities.push({
        id: Math.random().toString(), type: 'particle',
        position: { ...pos }, radius: 120, color: '#fffbeb', lifeTime: 0.1, scaleDecay: true
    });

    if (!isCapped) {
        // 3. Dense Fireball (Center)
        for (let i = 0; i < 40; i++) {
            const a = randomRange(0, Math.PI * 2);
            const d = randomRange(0, 40);
            state.world.entities.push({
                id: Math.random().toString(), type: 'particle',
                position: { x: pos.x + Math.cos(a) * d, y: pos.y + Math.sin(a) * d },
                velocity: { x: 0, y: 0 },
                color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444',
                radius: randomRange(40, 70),
                lifeTime: randomRange(0.4, 0.7),
                scaleDecay: true,
                shape: 'circle'
            });
        }

        // 4. Expanding Debris/Fire
        for (let i = 0; i < 60; i++) {
            const a = randomRange(0, Math.PI * 2);
            const s = randomRange(100, 600);
            const col = Math.random() > 0.7 ? '#fee2e2' : (Math.random() > 0.4 ? '#fca5a5' : '#ef4444');
            state.world.entities.push({
                id: Math.random().toString(), type: 'particle', position: pos,
                velocity: { x: Math.cos(a) * s, y: Math.sin(a) * s },
                color: col, radius: randomRange(10, 25), lifeTime: randomRange(0.5, 1.0),
                scaleDecay: true, drag: 0.9, gravity: true
            });
        }

        // 5. Heavy Smoke Trails
        for (let i = 0; i < 40; i++) {
            const a = randomRange(0, Math.PI * 2);
            const s = randomRange(50, 200);
            state.world.entities.push({
                id: Math.random().toString(), type: 'particle', shape: 'smoke',
                position: add(pos, { x: randomRange(-30, 30), y: randomRange(-30, 30) }),
                velocity: { x: Math.cos(a) * s, y: Math.sin(a) * s - 100 },
                color: '#1f2937', radius: randomRange(30, 60), lifeTime: randomRange(1.5, 2.5)
            });
        }
    }

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
    if (entity.type === 'particle' || entity.type === 'shockwave' || entity.type === 'floating_text' || entity.type === 'lightning' || entity.type === 'shockwave_ring') {
        if (entity.type === 'particle') {
            if (entity.drag) entity.velocity = mult(entity.velocity || { x: 0, y: 0 }, entity.drag);
            if (entity.gravity) entity.velocity!.y += GRAVITY * 0.8 * dt;
            if (entity.angularVelocity) entity.rotation = (entity.rotation || 0) + entity.angularVelocity * dt;
            if (entity.scaleDecay) entity.radius *= 0.95;
            if (entity.shape === 'smoke') entity.radius += 20 * dt;
        }
        if (entity.type === 'shockwave') entity.radius += 2500 * dt;
        if (entity.type === 'shockwave_ring') entity.radius += 1000 * dt;

        if (entity.velocity) entity.position = add(entity.position, mult(entity.velocity, dt));
        entity.lifeTime = (entity.lifeTime || 1.0) - dt;
        if (entity.lifeTime <= 0 || (entity.type === 'particle' && entity.radius < 0.2)) {
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
