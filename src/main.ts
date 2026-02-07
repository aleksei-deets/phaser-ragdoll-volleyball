import Phaser from 'phaser';
import { SandboxScene } from './scenes/SandboxScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#87CEEB',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.ScaleModes.FIT,
    autoCenter: Phaser.Scale.Center.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.2 },
      debug: false,
      positionIterations: 10,
      velocityIterations: 10,
      constraintIterations: 14,
    },
  },
  scene: [SandboxScene, GameScene],
};

new Phaser.Game(config);
