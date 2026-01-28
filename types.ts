

export interface Vector2 {
  x: number;
  y: number;
}

export enum GameStateStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  SHOP = 'SHOP',
  SETTINGS = 'SETTINGS',
  STATS = 'STATS',
}

export type BallTypeId =
  | 'red_common' | 'gold_rare' | 'cash_jackpot'
  | 'juice_refill' | 'pink_launch' | 'arrow_launch'
  | 'spike_normal' | 'spike_super'
  | 'hazard_minus' | 'missile_battery' | 'black_hole'
  | 'friendly_missile' | 'mini_ball'
  | 'flame_enemy' | 'electric_enemy';

export interface BallDefinition {
  id: BallTypeId;
  displayName: string;
  rarityTag: 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE' | 'ULTRA_RARE' | 'SPECIAL';
  radius: number;
  mass: number;
  bounciness: number;
  coreColor: string;
  glowColor: string;
  glowRadius: number;
  hasInnerDot?: boolean;
  symbol?: '+' | '-' | '$' | 'ARROW' | 'none';
  spikeStyle?: 'none' | 'normal' | 'super' | 'ultra';
  isTarget?: boolean;
  isHazard?: boolean;
  lethalOnTouch?: boolean;
  destroyableByDirectHit?: boolean;
  points: number;
  moneyReward?: number;
  juiceDelta?: number;
  fullJuiceRefill?: boolean;
  specialEffect?: 'NONE' | 'RANDOM_LAUNCH' | 'ARROW_LAUNCH' | 'DRAIN_DROP' | 'SPAWN_MISSILES' | 'BLACK_HOLE' | 'FIREBALL' | 'LIGHTNING';
  imageSrc?: string;
}

export type BossState =
  | 'SPAWNING' | 'IDLE_VULNERABLE' | 'ALIGNING' | 'DASHING' | 'STUNNED' | 'SHOOTING' | 'SCATTER' | 'LIGHTNING_STORM' | 'FIRE_NOVA'
  | 'WORM_CHASE' | 'WORM_SPLIT'
  | 'PRE_FIGHT' | 'CLOSING_WALLS' | 'ARC_BARRAGE' | 'SPIRAL_LANCES' | 'BEAM_CHARGE' | 'BEAM_FIRE' | 'MINE_FIELD' | 'MISSILE_STORM' | 'DYING' | 'SHATTER';

export type BossType = 'CUBE_OVERLORD' | 'WORM_DEVOURER' | 'TRIANGLE_ARCHITECT';

export interface Entity {
  id: string;
  type: 'player' | 'ball' | 'missile' | 'fireball' | 'acid_spit' | 'friendly_missile' | 'friendly_fireball' | 'bomb' | 'particle' | 'shockwave' | 'floating_text' | 'wall' | 'boss' | 'lightning' | 'super_missile' | 'mini_super_missile' | 'shockwave_ring' | 'stormfire_lance' | 'stormfire_chain';
  position: Vector2;
  radius: number;
  width?: number;
  height?: number;
  color: string;
  velocity?: Vector2;
  mass?: number;
  lifeTime?: number;
  maxLifeTime?: number;
  ballType?: BallTypeId;
  ballDef?: BallDefinition;
  targetId?: string;
  parentId?: string;
  lastAttackTime?: number;
  attackCharge?: number;
  aimPosition?: Vector2;
  invulnerableTime?: number;
  bossData?: {
    type: BossType;
    maxHealth: number;
    currentHealth: number;
    state: BossState;
    stateTimer: number;
    attackCounter: number;
    subStage?: number;
    invincibilityTimer: number;
    wormSegmentType?: 'HEAD' | 'BODY' | 'TAIL';
    wormParentId?: string;
    wormNextSegmentId?: string;
    wormPrevSegmentId?: string;
  };
  gravity?: boolean;
  isSpark?: boolean;
  scaleDecay?: boolean;
  shape?: 'circle' | 'square' | 'smoke' | 'triangle' | 'wedge';
  drag?: number;
  rotation?: number;
  angularVelocity?: number;
  points?: Vector2[];
  text?: string;
  scale?: number;
  isDebris?: boolean; // For VFX pooling system
  trail?: Vector2[]; // For visual trails
}

export interface Platform {
  id: string;
  position: Vector2;
  size: Vector2;
  type: 'start' | 'pillar';
}

export interface LavaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: 'bubble' | 'spark';
  size: number;
}

export interface GameState {
  player: {
    position: Vector2;
    velocity: Vector2;
    radius: number;
    health: number;
    mass: number;
    onGround: boolean;
    trail: Vector2[];
  };
  camera: {
    position: Vector2;
    zoom: number;
    shake: number;
  };
  input: {
    isDragging: boolean;
    startPos: Vector2;
    currentPos: Vector2;
    pointerId: number;
  };
  world: {
    entities: Entity[];
    platforms: Platform[];
    lavaParticles: LavaParticle[];
    lavaOffset: number;
  };
  worldGen: {
    nextRightX: number;
    nextLeftX: number;
  };
  combo: {
    multiplier: number;
    timer: number;
  };
  time: {
    scale: number;
    lastFrame: number;
    aliveDuration: number;
  };
  boss: {
    nextSpawnTime: number;
    active: boolean;
    lastHealth: number;
    maxHealth: number;
    cycleCount: number;
  };
  visuals: {
    aimLerp: number;
    time: number;
  };
  utility: {
    autoBounceState: 'OFF' | 'ACTIVE';
    activeTimer: number;
    charge: number;
    targetSearchTimer: number;
    currentTargetId: string | null;
    missileTimer: number;
    fireballTimer: number;
    bombTimer: number;
    lastHudUpdate: { unlocked: boolean, charge: number, active: boolean, time: number, bossHp: number };
    stormfireTimer: number;
    stormfireIcdTimer: number;
  };
  score: number;
  distanceRecord: number;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  score: number;
  gold: number;
  distanceTraveled: number;
}

export interface Upgrades {
  maxHealth: number;
  slowMoTimeScale: number;
  speedMultiplier: number;
  maxComboCap: number;
  missileChanceInterval: number;
  missileCap: number;
  fireballChance: number;
  bombChance: number;
  bombRadius: number;
  splitChance: number;
  splitCount: number;
  bounceMissileChance: number;
  bounceMissileCount: number;
  autoBounceDuration: number;
  autoBounceChargePerHit: number;
  spikeDestroyChance: number;
  chainLightningChance: number;
  chainLightningCount: number;
  unlockGreenSpikeBreaker: boolean;
  unlockRedSpikeBreaker: boolean;
  unlockParagonSuperMissile: boolean;
  unlockParagonStormfire: boolean;
}

export interface UpgradeItemDef {
  id: string;
  name: string;
  description: string;
  category: 'ESSENTIALS' | 'UTILITY' | 'PERMANENT' | 'PARAGON';
  stat: keyof Upgrades;
  baseValue: number;
  increment: number;
  maxLevel: number;
  costs: number[];
  iconType: 'health' | 'time' | 'speed' | 'combo' | 'missile' | 'split' | 'bounce_missile' | 'auto_bounce' | 'spike' | 'lightning' | 'fire' | 'bomb' | 'paragon';
  secondaryStat?: keyof Upgrades;
  secondaryBase?: number;
  secondaryIncrement?: number;
}

const TIER_COSTS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];

export const UPGRADE_ITEMS: UpgradeItemDef[] = [
  { id: 'more_juice', name: 'More Juice', description: 'Increases Max Juice Capacity', category: 'ESSENTIALS', stat: 'maxHealth', baseValue: 100, increment: 25, maxLevel: 9, costs: TIER_COSTS, iconType: 'health' },
  { id: 'slow_mo', name: '+Slow Mo', description: 'Stronger Slow Motion Aim', category: 'ESSENTIALS', stat: 'slowMoTimeScale', baseValue: 0.5, increment: -0.04, maxLevel: 9, costs: TIER_COSTS, iconType: 'time' },
  { id: 'speed', name: 'Speed', description: 'Increases Launch Velocity', category: 'ESSENTIALS', stat: 'speedMultiplier', baseValue: 1.0, increment: 0.08, maxLevel: 9, costs: TIER_COSTS, iconType: 'speed' },
  { id: 'max_combo', name: 'Max Combo', description: 'Increases Combo Multiplier Cap', category: 'ESSENTIALS', stat: 'maxComboCap', baseValue: 10, increment: 5, maxLevel: 9, costs: TIER_COSTS, iconType: 'combo' },
  { id: 'missiles', name: 'Auto Missiles', description: 'Periodically spawns friendly missiles', category: 'UTILITY', stat: 'missileChanceInterval', baseValue: 0.0, increment: 0.2, secondaryStat: 'missileCap', secondaryBase: 1, secondaryIncrement: 0.5, maxLevel: 9, costs: TIER_COSTS, iconType: 'missile' },
  { id: 'bomber', name: 'Bomber', description: 'Lobs explosive bombs at nearby targets', category: 'UTILITY', stat: 'bombChance', baseValue: 0.0, increment: 0.15, secondaryStat: 'bombRadius', secondaryBase: 250, secondaryIncrement: 25, maxLevel: 9, costs: TIER_COSTS, iconType: 'bomb' },
  { id: 'auto_fireball', name: 'Auto Fireball', description: 'Charges a fireball to blast enemies', category: 'UTILITY', stat: 'fireballChance', baseValue: 0.0, increment: 0.15, maxLevel: 9, costs: TIER_COSTS, iconType: 'fire' },
  { id: 'chain_lightning', name: 'Chain Lightning', description: 'Chance to arc lightning to neighbors', category: 'UTILITY', stat: 'chainLightningChance', baseValue: 0.0, increment: 0.05, secondaryStat: 'chainLightningCount', secondaryBase: 1, secondaryIncrement: 0.5, maxLevel: 9, costs: TIER_COSTS, iconType: 'lightning' },
  { id: 'split', name: 'Split', description: 'Chance for targets to split on hit', category: 'UTILITY', stat: 'splitChance', baseValue: 0.0, increment: 0.06, secondaryStat: 'splitCount', secondaryBase: 1, secondaryIncrement: 0.2, maxLevel: 9, costs: TIER_COSTS, iconType: 'split' },
  { id: 'bounce_missile', name: 'Bounce Missile', description: 'Chance to spawn missile on impact', category: 'UTILITY', stat: 'bounceMissileChance', baseValue: 0.0, increment: 0.08, secondaryStat: 'bounceMissileCount', secondaryBase: 1, secondaryIncrement: 0.1, maxLevel: 9, costs: TIER_COSTS, iconType: 'bounce_missile' },
  { id: 'auto_bounce', name: 'Auto-Bounce', description: 'Charges by breaking targets', category: 'UTILITY', stat: 'autoBounceDuration', baseValue: 2.0, increment: 0.5, secondaryStat: 'autoBounceChargePerHit', secondaryBase: 0.04, secondaryIncrement: 0.01, maxLevel: 9, costs: TIER_COSTS, iconType: 'auto_bounce' },
  { id: 'green_spike_breaker', name: 'Green Spike Breaker', description: 'Permanently allow smashing Green Spikes', category: 'PERMANENT', stat: 'unlockGreenSpikeBreaker', baseValue: 0, increment: 1, maxLevel: 1, costs: [5000], iconType: 'spike' },
  { id: 'red_spike_breaker', name: 'Red Spike Breaker', description: 'Permanently allow smashing Red Spikes', category: 'PERMANENT', stat: 'unlockRedSpikeBreaker', baseValue: 0, increment: 1, maxLevel: 1, costs: [25000], iconType: 'spike' },
  { id: 'paragon_super_missile', name: 'Super Missile', description: 'Replaces all missiles with Ultimate Seeking Missiles that split on impact.', category: 'PARAGON', stat: 'unlockParagonSuperMissile', baseValue: 0, increment: 1, maxLevel: 1, costs: [1250000], iconType: 'paragon' },
  { id: 'paragon_stormfire', name: 'PARAGON: Stormfire', description: 'Replaces Auto Fireball & Chain Lightning with devastating Stormfire Lances that chain to nearby enemies.', category: 'PARAGON', stat: 'unlockParagonStormfire', baseValue: 0, increment: 1, maxLevel: 1, costs: [1250000], iconType: 'paragon' }
];

export const SKIN_ITEMS = [
  { id: 'skin_neon', name: 'Neon Skin', description: 'Glow in the dark', cost: 500, skinId: 'neon' },
  { id: 'skin_gold', name: 'Midas Touch', description: 'Pure Gold Finish', cost: 2500, skinId: 'gold' },
  { id: 'skin_void', name: 'Void Walker', description: 'Absorb the light', cost: 5000, skinId: 'void' },
];
