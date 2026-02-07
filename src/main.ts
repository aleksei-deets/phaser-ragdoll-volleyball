import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#87CEEB',
  parent: document.body,
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
  scene: [GameScene],
};

new Phaser.Game(config);
