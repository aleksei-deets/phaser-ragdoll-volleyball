import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Загрузка ассетов
  }

  create(): void {
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Phaser 4 + Vite + TypeScript',
      {
        fontSize: '32px',
        color: '#ffffff',
      }
    ).setOrigin(0.5);
  }

  update(): void {
    // Игровой цикл
  }
}
