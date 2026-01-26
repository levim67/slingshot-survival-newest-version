
import { BallTypeId, BallDefinition } from '../types';

export const GRAVITY = 900;
export const LAVA_LEVEL = 600;
export const CHUNK_SIZE = 1200;
export const GENERATION_BUFFER = 3000;
export const CONST_DECAY_RATE = 2.0;
export const BOSS_SPAWN_INTERVAL = 50; // Faster pacing

export const BALL_DEFINITIONS: Record<BallTypeId, BallDefinition> = {
  // A) SAFE TARGETS
  'red_common': {
    id: 'red_common', displayName: 'Target', rarityTag: 'COMMON',
    radius: 28, mass: 1, bounciness: 0.8,
    coreColor: '#ef4444', glowColor: '#ff0055', glowRadius: 40, hasInnerDot: false,
    points: 100, juiceDelta: 25, isTarget: true, destroyableByDirectHit: true,
    symbol: 'none'
  },
  'gold_rare': {
    id: 'gold_rare', displayName: 'Gold', rarityTag: 'RARE',
    radius: 26, mass: 1, bounciness: 0.9,
    coreColor: '#fbbf24', glowColor: '#f59e0b', glowRadius: 45, hasInnerDot: false,
    points: 2000, moneyReward: 5, juiceDelta: 50, isTarget: true, destroyableByDirectHit: true,
    symbol: 'none'
  },
  'cash_jackpot': {
    id: 'cash_jackpot', displayName: 'Jackpot', rarityTag: 'VERY_RARE',
    radius: 32, mass: 1.5, bounciness: 0.6,
    coreColor: '#22c55e', glowColor: '#4ade80', glowRadius: 50, symbol: '$',
    points: 5000, moneyReward: 50, juiceDelta: 50, isTarget: true, destroyableByDirectHit: true
  },
  'mini_ball': {
    id: 'mini_ball', displayName: 'Mini', rarityTag: 'SPECIAL',
    radius: 18, mass: 0.5, bounciness: 0.9,
    coreColor: '#ff00ff', glowColor: '#ff00ff', glowRadius: 30,
    points: 50, juiceDelta: 10, isTarget: true, destroyableByDirectHit: true,
    symbol: 'none'
  },

  // B) UTILITY
  'juice_refill': {
    id: 'juice_refill', displayName: 'Juice', rarityTag: 'UNCOMMON',
    radius: 24, mass: 0.8, bounciness: 0.5,
    coreColor: '#ffffff', glowColor: '#a5f3fc', glowRadius: 40, symbol: '+',
    points: 100, fullJuiceRefill: true, isTarget: true, destroyableByDirectHit: true,
    specialEffect: 'NONE'
  },
  'pink_launch': {
    id: 'pink_launch', displayName: 'Wild', rarityTag: 'UNCOMMON',
    radius: 26, mass: 2, bounciness: 1.5,
    coreColor: '#d946ef', glowColor: '#f0abfc', glowRadius: 35,
    points: 100, isTarget: true, destroyableByDirectHit: true,
    specialEffect: 'RANDOM_LAUNCH',
    symbol: 'none'
  },
  'arrow_launch': {
    id: 'arrow_launch', displayName: 'Boost', rarityTag: 'UNCOMMON',
    radius: 26, mass: 2, bounciness: 1.2,
    coreColor: '#06b6d4', glowColor: '#22d3ee', glowRadius: 35, symbol: 'ARROW',
    points: 600, isTarget: true, destroyableByDirectHit: true,
    specialEffect: 'ARROW_LAUNCH'
  },

  // C) HAZARDS
  'spike_normal': {
    id: 'spike_normal', displayName: 'Spike', rarityTag: 'COMMON',
    radius: 42, mass: 2, bounciness: 0.4,
    coreColor: '#22c55e', glowColor: '#4ade80', glowRadius: 60, spikeStyle: 'normal',
    points: 400, isHazard: true, lethalOnTouch: true,
    specialEffect: 'NONE',
    symbol: 'none'
  },
  'spike_super': {
    id: 'spike_super', displayName: 'Super Spike', rarityTag: 'RARE',
    radius: 48, mass: 3, bounciness: 0.2,
    coreColor: '#ef4444', glowColor: '#f87171', glowRadius: 75, spikeStyle: 'super',
    points: 1200, isHazard: true, lethalOnTouch: true,
    specialEffect: 'NONE',
    symbol: 'none'
  },
  'black_hole': {
    id: 'black_hole', displayName: 'Void', rarityTag: 'ULTRA_RARE',
    radius: 50, mass: 1000, bounciness: 0,
    coreColor: '#000000', glowColor: '#9333ea', glowRadius: 60,
    points: 0, isHazard: true, lethalOnTouch: false,
    specialEffect: 'BLACK_HOLE',
    symbol: 'none'
  },
  'missile_battery': {
    id: 'missile_battery', displayName: 'Battery', rarityTag: 'RARE',
    radius: 35, mass: 5, bounciness: 0.1,
    coreColor: '#ea580c', glowColor: '#fdba74', glowRadius: 30,
    points: 1000, isHazard: true,
    specialEffect: 'SPAWN_MISSILES',
    symbol: 'none',
    destroyableByDirectHit: true
  },
  'flame_enemy': {
    id: 'flame_enemy', displayName: 'Flamer', rarityTag: 'RARE',
    radius: 38, mass: 3, bounciness: 0.2,
    coreColor: '#f97316', glowColor: '#fbbf24', glowRadius: 50,
    points: 1500, isHazard: true,
    specialEffect: 'FIREBALL',
    symbol: 'none', destroyableByDirectHit: true
  },
  'electric_enemy': {
    id: 'electric_enemy', displayName: 'Zapper', rarityTag: 'RARE',
    radius: 38, mass: 3, bounciness: 0.2,
    coreColor: '#06b6d4', glowColor: '#67e8f9', glowRadius: 50,
    points: 1500, isHazard: true,
    specialEffect: 'LIGHTNING',
    symbol: 'none', destroyableByDirectHit: true
  },

  // D) DEPRECATED / PLACEHOLDERS
  'hazard_minus': { id: 'hazard_minus', displayName: '', rarityTag: 'COMMON', radius: 1, mass: 1, bounciness: 1, coreColor: '#000', glowColor: '#000', glowRadius: 1, points: 0 },
  'friendly_missile': { id: 'friendly_missile', displayName: '', rarityTag: 'COMMON', radius: 1, mass: 1, bounciness: 1, coreColor: '#000', glowColor: '#000', glowRadius: 1, points: 0 },
};
