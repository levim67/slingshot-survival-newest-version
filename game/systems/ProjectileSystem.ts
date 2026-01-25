
import { GameState, Entity, Upgrades, Vector2 } from '../../types';
import { add, sub, mult, mag, normalize, dist, checkCollision, checkCircleRect, checkLineCircle, resolveElasticCollision, randomRange } from '../../utils/physics';
import { GRAVITY, LAVA_LEVEL, BALL_DEFINITIONS } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { spawnFloatingText, addShake, findBestTarget } from '../spawners/EffectSpawner';
import { spawnExplosion, spawnDirectionalBurst, generateLightningPoints } from './VFXSystem';
import { spawnFriendlyMissile, spawnSuperMissileSplit } from '../spawners/ProjectileSpawner';
import { handleWormSegmentDeath } from './BossSystem';

interface DestroyBallContext {
    upgrades: Upgrades;
    entitiesToRemove: Set<string>;
}

/**
 * Updates friendly missiles (standard and super)
 */
export const updateFriendlyProjectiles = (
    state: GameState,
    entity: Entity,
    dt: number,
    activeEntities: Entity[],
    entitiesToRemove: Set<string>,
    upgrades: Upgrades,
    destroyBallFn: (state: GameState, entity: Entity, upgrades: Upgrades, entitiesToRemove: Set<string>, cause: string) => void
): boolean => {
    // SUPER MISSILE & MINI MISSILE LOGIC
    if (entity.type === 'super_missile' || entity.type === 'mini_super_missile') {
        const isMini = entity.type === 'mini_super_missile';
        const target = findBestTarget(state);
        const speed = isMini ? 1200 : 1000;
        const turnSpeed = isMini ? 8 : 6;

        if (target) {
            const toTarget = sub(target.position, entity.position);
            const desired = mult(normalize(toTarget), speed);
            const steer = mult(sub(desired, entity.velocity || { x: 0, y: 0 }), turnSpeed * dt);
            entity.velocity = add(entity.velocity || { x: 0, y: 0 }, steer);
        }

        // Trail Update
        if (!entity.trail) entity.trail = [];
        if (entity.trail.length < 10) {
            entity.trail.push({ ...entity.position });
        } else {
            entity.trail.shift();
            entity.trail.push({ ...entity.position });
        }

        entity.position = add(entity.position, mult(entity.velocity || { x: 0, y: 0 }, dt));
        entity.rotation = Math.atan2(entity.velocity!.y, entity.velocity!.x);
        entity.lifeTime = (entity.lifeTime || 0) - dt;

        if (entity.lifeTime <= 0) entitiesToRemove.add(entity.id);

        // Collision
        for (const other of activeEntities) {
            if ((other.type === 'ball' && other.ballDef && other.ballDef.isTarget) || (other.type === 'boss' && other.bossData?.type === 'WORM_DEVOURER')) {
                if (checkCollision(entity.position, entity.radius, other.position, other.radius)) {
                    entitiesToRemove.add(entity.id);

                    // Spawn shockwave ring
                    if (state.world.entities.length < 1200) {
                        state.world.entities.push({
                            id: `shockwave_${Math.random()}`,
                            type: 'shockwave_ring',
                            position: { ...entity.position },
                            radius: 10,
                            color: '#22d3ee',
                            lifeTime: 0.3,
                            velocity: { x: 0, y: 0 }
                        });
                    }
                    audio.playSFX('super_impact', isMini ? 0.6 : 1.0);

                    if (other.type === 'boss') {
                        other.bossData!.currentHealth -= isMini ? 100 : 500;
                        spawnFloatingText(state, other.position, isMini ? "-100" : "-500", '#00ffff');
                        if (other.bossData!.currentHealth <= 0) handleWormSegmentDeath(state, other, entitiesToRemove, upgrades);
                    } else {
                        entitiesToRemove.add(other.id);
                        destroyBallFn(state, other, upgrades, entitiesToRemove, 'MISSILE');
                    }

                    if (!isMini) {
                        spawnSuperMissileSplit(state, entity.position, 4);
                    }
                    break;
                }
            }
        }
        return true;
    }

    // FRIENDLY MISSILE / FIREBALL
    if (entity.type === 'friendly_missile' || entity.type === 'friendly_fireball') {
        const target = findBestTarget(state);
        const isFire = entity.type === 'friendly_fireball';
        const speed = isFire ? 900 : 800;
        const turnSpeed = isFire ? 3 : 5;

        if (target) {
            const toTarget = sub(target.position, entity.position);
            const desired = mult(normalize(toTarget), speed);
            const steer = mult(sub(desired, entity.velocity || { x: 0, y: 0 }), turnSpeed * dt);
            entity.velocity = add(entity.velocity || { x: 0, y: 0 }, steer);
        }
        entity.position = add(entity.position, mult(entity.velocity || { x: 0, y: 0 }, dt));
        entity.rotation = Math.atan2(entity.velocity!.y, entity.velocity!.x);
        entity.lifeTime = (entity.lifeTime || 0) - dt;

        // Trail
        if (Math.random() < 0.5 && state.world.entities.length < 1200) {
            state.world.entities.push({
                id: `trail_${Math.random()}`, type: 'particle', position: { ...entity.position },
                velocity: mult(normalize(entity.velocity || { x: 0, y: 0 }), -100),
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
                        destroyBallFn(state, other, upgrades, entitiesToRemove, 'MISSILE');
                    }
                    break;
                }
            }
        }
        return true;
    }

    return false;
};

/**
 * Updates enemy projectiles (missiles, fireballs, acid spit)
 */
export const updateEnemyProjectiles = (
    state: GameState,
    entity: Entity,
    dt: number,
    isImmune: boolean,
    entitiesToRemove: Set<string>
): boolean => {
    if ((entity.type === 'missile' || entity.type === 'fireball' || entity.type === 'acid_spit') && entity.targetId === 'player') {
        const isFireball = entity.type === 'fireball';
        const isAcid = entity.type === 'acid_spit';
        const toPlayer = sub(state.player.position, entity.position);
        const desired = mult(normalize(toPlayer), isFireball ? 400 : (isAcid ? 300 : 500));
        const currentVel = entity.velocity || { x: 0, y: 0 };
        const steerStrength = isFireball ? 1.5 : (isAcid ? 0.5 : 2.5);
        const steer = mult(sub(desired, currentVel), steerStrength * dt);
        entity.velocity = add(currentVel, steer);

        entity.position = add(entity.position, mult(entity.velocity, dt));
        entity.rotation = Math.atan2(entity.velocity.y, entity.velocity.x);

        if (Math.random() < 0.4 && state.world.entities.length < 1200) {
            state.world.entities.push({
                id: `trail_${Math.random()}`, type: 'particle', position: { ...entity.position },
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
        return true;
    }
    return false;
};

/**
 * Updates bomb physics and explosion trigger
 */
export const updateBomb = (
    state: GameState,
    entity: Entity,
    dt: number,
    activeEntities: Entity[],
    entitiesToRemove: Set<string>,
    explodeBombFn: (state: GameState, pos: Vector2, upgrades: Upgrades, entitiesToRemove: Set<string>) => void,
    upgrades: Upgrades
): boolean => {
    if (entity.type !== 'bomb') return false;

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
        explodeBombFn(state, entity.position, upgrades, entitiesToRemove);
    }
    return true;
};
