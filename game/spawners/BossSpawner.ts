
import { GameState, Entity, Upgrades, Vector2 } from '../../types';
import { add, mult, normalize, sub, mag, dist, randomRange, clamp } from '../../utils/physics';
import { GRAVITY, LAVA_LEVEL, BALL_DEFINITIONS, BOSS_SPAWN_INTERVAL } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { spawnFloatingText, addShake } from './EffectSpawner';
import { spawnExplosion } from '../systems/VFXSystem';

/**
 * Spawns the Cube Overlord boss
 */
export const spawnCubeBoss = (state: GameState) => {
    const maxHp = 50000;
    state.boss.maxHealth = maxHp;
    const spawnY = state.player.position.y - 600;
    spawnFloatingText(state, { x: state.player.position.x, y: spawnY + 200 }, "WARNING: CUBE OVERLORD", '#ff0000');
    audio.playSFX('charge');
    audio.playSFX('boss_roar');
    state.world.entities.push({
        id: `boss_cube_${Math.random()}`, type: 'boss',
        position: { x: state.player.position.x, y: spawnY },
        radius: 80, color: '#ffffff', velocity: { x: 0, y: 0 },
        bossData: {
            type: 'CUBE_OVERLORD', maxHealth: maxHp, currentHealth: maxHp,
            state: 'SPAWNING', stateTimer: 3.0, attackCounter: 0, subStage: 0, invincibilityTimer: 0
        }
    });
};

/**
 * Spawns the Worm Devourer boss with multiple segments
 */
export const spawnWormBoss = (state: GameState) => {
    const segments = 15;
    const hpPerSeg = 20000;
    state.boss.maxHealth = segments * hpPerSeg;
    spawnFloatingText(state, { x: state.player.position.x, y: state.player.position.y - 400 }, "WARNING: THE DEVOURER AWAKENS", '#a3e635');
    audio.playSFX('boss_roar');
    const startX = state.player.position.x - 1000;
    const startY = state.player.position.y + 500;
    let prevId: string | undefined = undefined;
    const segs: Entity[] = [];
    for (let i = 0; i < segments; i++) {
        const id = `boss_worm_${Math.random()}`;
        const isHead = i === 0;
        const isTail = i === segments - 1;
        const type = isHead ? 'HEAD' : (isTail ? 'TAIL' : 'BODY');
        segs.push({
            id: id, type: 'boss',
            position: { x: startX - (i * 60), y: startY + (i * 60) },
            radius: isHead ? 60 : 50,
            color: isHead ? '#a3e635' : (isTail ? '#3f6212' : '#65a30d'),
            velocity: { x: 400, y: -400 },
            bossData: {
                type: 'WORM_DEVOURER', maxHealth: hpPerSeg, currentHealth: hpPerSeg,
                state: 'WORM_CHASE', stateTimer: 0, attackCounter: 0, invincibilityTimer: 0,
                wormSegmentType: type, wormPrevSegmentId: prevId
            }
        });
        prevId = id;
    }
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i].bossData) segs[i].bossData!.wormNextSegmentId = segs[i + 1].id;
    }
    state.world.entities.push(...segs);
};

/**
 * Handles boss death and rewards
 */
export const killBoss = (state: GameState, bossEntity: Entity | null, upgrades: Upgrades) => {
    state.boss.active = false;
    state.boss.nextSpawnTime = state.time.aliveDuration + BOSS_SPAWN_INTERVAL;
    state.boss.cycleCount++;

    state.score += 50000;
    state.player.health = upgrades.maxHealth;

    if (bossEntity) {
        spawnExplosion(state, bossEntity.position, '#ffffff', '#ffd700', { x: 0, y: 0 });
        spawnFloatingText(state, bossEntity.position, "BOSS DEFEATED", '#ffd700');
    } else {
        spawnFloatingText(state, state.player.position, "VICTORY", '#ffd700');
    }
};
