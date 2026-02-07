/** Полный конфиг песочницы для сохранения в пресеты и применения к сцене */
export interface SandboxConfig {
  gravityX: number;
  gravityY: number;
  impulseStrength: number;
  frictionAirTorso: number;
  frictionAirLimbs: number;
  density: number;
  friction: number;
  frictionStatic: number;
  restitution: number;
  stabilizationMultiplier: number;
  stabilizationTorsoKp: number;
  stabilizationTorsoKd: number;
  stabilizationHeadKp: number;
  stabilizationHeadKd: number;
  stabilizationLegKp: number;
  stabilizationLegKd: number;
  stabilizationArmKp: number;
  stabilizationArmKd: number;
  enforceStructureStrength: number;
  positionIterations: number;
  velocityIterations: number;
  constraintIterations: number;
  jumpVelocity: number;
  armLiftOnJump: number;
  densityTorso: number;
  densityLimbs: number;
  maxVerticalSpeed: number;
  angularDamping: number;
  footRestitution: number;
  horizontalImpulseScale: number;
  verticalImpulseScale: number;
  jumpCooldownMs: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  gravityX: 0,
  gravityY: 1.2,
  impulseStrength: 0.7,
  frictionAirTorso: 0.25,
  frictionAirLimbs: 0.03,
  density: 0.002,
  friction: 0.4,
  frictionStatic: 0.6,
  restitution: 0.05,
  stabilizationMultiplier: 1,
  stabilizationTorsoKp: 0.5,
  stabilizationTorsoKd: 0.6,
  stabilizationHeadKp: 0.3,
  stabilizationHeadKd: 0.5,
  stabilizationLegKp: 0.25,
  stabilizationLegKd: 0.5,
  stabilizationArmKp: 0.15,
  stabilizationArmKd: 0.5,
  enforceStructureStrength: 0.015,
  positionIterations: 10,
  velocityIterations: 10,
  constraintIterations: 14,
  jumpVelocity: 12,
  armLiftOnJump: 0.8,
  densityTorso: 0.002,
  densityLimbs: 0.002,
  maxVerticalSpeed: 0,
  angularDamping: 0,
  footRestitution: 0.05,
  horizontalImpulseScale: 1,
  verticalImpulseScale: 1,
  jumpCooldownMs: 400,
};

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
