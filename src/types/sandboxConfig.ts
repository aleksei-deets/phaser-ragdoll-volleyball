/** Полный конфиг песочницы для сохранения в пресеты и применения к сцене (p2-es) */
export interface SandboxConfig {
  // ── World ──────────────────────────────────────────────────────────
  gravityX: number;
  gravityY: number;            // p2: positive = up; typically -10
  solverIterations: number;
  solverTolerance: number;

  // ── Body ───────────────────────────────────────────────────────────
  bodyMass: number;
  damping: number;
  angularDamping: number;

  // ── Joint limits (degrees — converted to radians at runtime) ──────
  jointLimitNeck: number;
  jointLimitKnee: number;
  jointLimitHip: number;
  jointLimitSpine: number;
  jointLimitShoulder: number;
  jointLimitElbow: number;

  // ── Contact material ───────────────────────────────────────────────
  friction: number;
  restitution: number;

  // ── Movement ───────────────────────────────────────────────────────
  jumpVelocity: number;
  jumpCooldownMs: number;
  moveForce: number;
  maxHorizontalSpeed: number;
  armLiftOnJump: number;

  // ── Sandbox-specific impulse tweaks ────────────────────────────────
  impulseStrength: number;
  horizontalImpulseScale: number;
  verticalImpulseScale: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  gravityX: 0,
  gravityY: -10,
  solverIterations: 100,
  solverTolerance: 0.002,

  bodyMass: 1,
  damping: 0,
  angularDamping: 0,

  jointLimitNeck: 22.5,      // PI/8 in degrees
  jointLimitKnee: 22.5,
  jointLimitHip: 22.5,
  jointLimitSpine: 22.5,
  jointLimitShoulder: 60,    // PI/3 in degrees
  jointLimitElbow: 22.5,

  friction: 3,
  restitution: 0,

  jumpVelocity: 7,
  jumpCooldownMs: 400,
  moveForce: 50,
  maxHorizontalSpeed: 5,
  armLiftOnJump: 0.8,

  impulseStrength: 1,
  horizontalImpulseScale: 1,
  verticalImpulseScale: 1,
};

/** Degrees → radians helper */
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Базовый URL папки пресетов (public/presets в dev и build) */
export const PRESETS_BASE_URL = '/presets';

/** Манифест списка пресетов в папке presets */
export interface PresetsManifest {
  presets: Array<{ file: string; name: string }>;
}

export interface SavedPreset {
  name: string;
  config: SandboxConfig;
}
