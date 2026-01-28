
import { GameState, Upgrades, Entity } from '../../types';
import { mag, normalize, sub, mult, clamp } from '../../utils/physics';
import * as audio from '../../utils/audio';
import { findBestTarget, findBombTarget, spawnFloatingText } from '../spawners/EffectSpawner';
import { spawnFriendlyMissile, spawnFriendlyBomb, spawnFriendlyFireball } from '../spawners/ProjectileSpawner';
import { killBoss } from '../spawners/BossSpawner';
import { updateStormfirePassive } from './StormfireSystem';

/**
 * Updates the auto-bounce ability state machine
 */
export const updateAutoBounce = (state: GameState, realDt: number, gameDt: number, upgrades: Upgrades) => {
    const util = state.utility;
    const t = clamp((upgrades.autoBounceDuration - 2.0) / 3.0, 0, 1);
    const duration = upgrades.autoBounceDuration || 2.0;
    const steering = 8 + (6 * t);

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
            // SAFETY BRAKE: Cap velocity
            const currentSpeed = mag(state.player.velocity);
            const safeSpeed = Math.min(currentSpeed, 600);
            const safeDir = normalize(state.player.velocity);
            if (safeDir.y > 0.5) safeDir.y = 0.5;

            state.player.velocity = mult(normalize(safeDir), safeSpeed);
        }
    } else {
        audio.updateGlobalTimeScale(state.time.scale);
    }
};

/**
 * Updates combo timer and decay
 */
export const updateCombo = (state: GameState, gameDt: number) => {
    if (state.combo.multiplier > 1) {
        state.combo.timer -= gameDt;
        if (state.combo.timer <= 0) {
            state.combo.multiplier = 1;
            spawnFloatingText(state, state.player.position, "COMBO LOST", '#ff4444');
        }
    }
};

/**
 * Updates passive ability timers (missiles, bombs, fireballs)
 */
export const updatePassiveAbilities = (state: GameState, gameDt: number, upgrades: Upgrades) => {
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

    // Auto Fireball - DISABLED if Stormfire is purchased
    if (upgrades.fireballChance > 0 && !upgrades.unlockParagonStormfire) {
        state.utility.fireballTimer += gameDt;
        const interval = 1.0 / Math.max(0.1, upgrades.fireballChance);
        if (state.utility.fireballTimer > interval) {
            state.utility.fireballTimer = 0;
            spawnFriendlyFireball(state);
        }
    }

    // PARAGON: Stormfire passive proc (replaces Auto Fireball + adds passive spawning)
    updateStormfirePassive(state, gameDt, upgrades);
};

/**
 * Updates HUD state callbacks (throttled to reduce React renders)
 */
export const updateHUD = (
    state: GameState,
    upgrades: Upgrades,
    callback: (unlocked: boolean, cooldownRemaining: number, isActive: boolean, timeAlive: number, bossHp: number, maxBossHp: number) => void
) => {
    const currentUnlocked = (upgrades.autoBounceDuration > 0);
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
        killBoss(state, null, upgrades);
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
