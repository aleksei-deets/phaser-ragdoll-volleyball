import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
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
  scene: [MainMenuScene, SandboxScene, GameScene],
};

new Phaser.Game(config);
