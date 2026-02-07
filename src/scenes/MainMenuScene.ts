import Phaser from 'phaser';

const GAME_W = 800;
const GAME_H = 600;

const COLOR_BG_TOP = 0x1a2a4a;
const COLOR_BG_BOTTOM = 0x3a5a8a;

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // Меню на весь экран: сброс высоты контейнера и скрытие панели
    const gameContainer = document.getElementById('game-container');
    const panelArea = document.getElementById('panel-area');
    const panel = document.getElementById('controls-panel');
    if (gameContainer) gameContainer.style.height = '';
    if (panelArea) panelArea.style.display = 'none';
    if (panel) panel.style.display = 'none';
    requestAnimationFrame(() => {
      this.scale.getParentBounds();
      this.scale.refresh();
    });

    this.drawBackground();
    this.createTitle();
    this.createMenuItems();
  }

  // ─── Фон ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    const gfx = this.add.graphics();
    const steps = 30;
    const stepH = GAME_H / steps;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = lerpColor(COLOR_BG_TOP, COLOR_BG_BOTTOM, t);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, i * stepH, GAME_W, stepH + 1);
    }

    // Декоративная линия-разделитель под заголовком
    const line = this.add.graphics().setDepth(10);
    line.lineStyle(2, 0xffffff, 0.15);
    line.beginPath();
    line.moveTo(GAME_W * 0.2, 230);
    line.lineTo(GAME_W * 0.8, 230);
    line.strokePath();
  }

  // ─── Заголовок ─────────────────────────────────────────────────────

  private createTitle(): void {
    this.add
      .text(GAME_W / 2, 100, 'RAGDOLL', {
        fontSize: '64px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(GAME_W / 2, 175, 'VOLLEYBALL', {
        fontSize: '42px',
        color: '#ffcc44',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }

  // ─── Пункты меню ──────────────────────────────────────────────────

  private createMenuItems(): void {
    this.createButton(GAME_W / 2, 310, 'Настроить персонажа', () => {
      this.scene.start('SandboxScene');
    });

    this.createButton(GAME_W / 2, 400, 'Играть', () => {
      this.scene.start('GameScene');
    });
  }

  // ─── Кнопка с hover-эффектом ──────────────────────────────────────

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const w = 320;
    const h = 56;
    const radius = 12;

    const bg = this.add.graphics().setDepth(10);

    const drawBg = (fill: number, alpha: number) => {
      bg.clear();
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
      bg.lineStyle(2, 0xffffff, 0.25);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    };

    drawBg(0x3377ee, 0.85);

    const text = this.add
      .text(x, y, label, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11);

    const zone = this.add
      .rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);

    zone.on('pointerover', () => {
      drawBg(0x5599ff, 1);
      text.setScale(1.04);
    });

    zone.on('pointerout', () => {
      drawBg(0x3377ee, 0.85);
      text.setScale(1);
    });

    zone.on('pointerdown', onClick);
  }
}

// ─── Утилита: линейная интерполяция цвета ──────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
  const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;

  return (
    (Math.round(rA + (rB - rA) * t) << 16) |
    (Math.round(gA + (gB - gA) * t) << 8) |
    Math.round(bA + (bB - bA) * t)
  );
}
