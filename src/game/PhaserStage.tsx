'use client';

/**
 * Phaser 3 interactive shop stage.
 * Renders the Bangladeshi grocery shop interior, animated ceiling fan, custom signboard,
 * shelves, fridge, shopkeeper, customer slots with patience bars, weather/blackout effects,
 * scene hotspots, and floating score/cash popups.
 */
import React, { useEffect, useRef } from 'react';
import type { Sim } from '@/core/sim';
import type { Lang, SimEvent } from '@/core/types';
import { CUSTOMIZATION_MAP, DEFAULT_EQUIPPED, type CustomizationCategory } from '@/content/customization';
import { BOSS_NAMES } from '@/content/levels';
import { pick } from '@/lib/i18n';
import { characterDataUrl, hotspotBadgeInfo, shopkeeperDataUrl } from './art/shop';
import type { Expression } from './art/characters';

export interface PhaserStageProps {
  sim: Sim;
  events: SimEvent[];
  lang: Lang;
  equipped: Record<CustomizationCategory, string>;
  onSelectCustomer: (customerId: number) => void;
  onTapHotspot: (hotspotId: number) => void;
}

interface BridgeState {
  sim: Sim;
  lang: Lang;
  equipped: Record<CustomizationCategory, string>;
  onSelectCustomer: (id: number) => void;
  onTapHotspot: (id: number) => void;
  queueEvents: SimEvent[];
}

export default function PhaserStage({
  sim,
  events,
  lang,
  equipped,
  onSelectCustomer,
  onTapHotspot,
}: PhaserStageProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<BridgeState>({
    sim,
    lang,
    equipped,
    onSelectCustomer,
    onTapHotspot,
    queueEvents: [],
  });

  bridgeRef.current.sim = sim;
  bridgeRef.current.lang = lang;
  bridgeRef.current.equipped = equipped;
  bridgeRef.current.onSelectCustomer = onSelectCustomer;
  bridgeRef.current.onTapHotspot = onTapHotspot;

  useEffect(() => {
    if (events.length > 0) {
      bridgeRef.current.queueEvents.push(...events);
    }
  }, [events]);

  useEffect(() => {
    let destroyed = false;
    let gameInstance: import('phaser').Game | null = null;

    async function boot(): Promise<void> {
      if (!containerRef.current || destroyed) return;
      const PhaserMod = await import('phaser');
      const Phaser = PhaserMod.default ?? PhaserMod;
      if (destroyed || !containerRef.current) return;

      const W = 720;
      const H = 300;

      class DokaanScene extends Phaser.Scene {
        private bgGfx!: import('phaser').GameObjects.Graphics;
        private weatherGfx!: import('phaser').GameObjects.Graphics;
        private overlayGfx!: import('phaser').GameObjects.Graphics;
        private fanGfx!: import('phaser').GameObjects.Graphics;
        private signText!: import('phaser').GameObjects.Text;
        private shopkeeperImg!: import('phaser').GameObjects.Image;
        private bossImg?: import('phaser').GameObjects.Image;
        private slotContainers = new Map<
          number,
          {
            container: import('phaser').GameObjects.Container;
            sprite: import('phaser').GameObjects.Image;
            barGfx: import('phaser').GameObjects.Graphics;
            ringGfx: import('phaser').GameObjects.Graphics;
            tagText: import('phaser').GameObjects.Text;
            texKey: string;
          }
        >();
        private hotspotObjs = new Map<
          number,
          {
            container: import('phaser').GameObjects.Container;
            bg: import('phaser').GameObjects.Graphics;
            label: import('phaser').GameObjects.Text;
          }
        >();
        private loadedKeys = new Set<string>();
        private loadingKeys = new Set<string>();
        private keeperExpr: Expression = 'neutral';
        private keeperExprUntil = 0;
        private lastStyleKey = '';

        constructor() {
          super('DokaanScene');
        }

        create(): void {
          this.bgGfx = this.add.graphics();
          this.fanGfx = this.add.graphics();
          this.signText = this.add
            .text(W / 2, 26, '', {
              fontFamily: "'Baloo Da 2','Hind Siliguri',sans-serif",
              fontSize: '20px',
              fontStyle: 'bold',
              color: '#FFFFFF',
              stroke: '#3B2314',
              strokeThickness: 4,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(5);

          // Shopkeeper behind the right side of the counter
          this.shopkeeperImg = this.add
            .image(615, 195, '__DEFAULT')
            .setDisplaySize(108, 142)
            .setDepth(12)
            .setAlpha(0);

          this.weatherGfx = this.add.graphics().setDepth(30);
          this.overlayGfx = this.add.graphics().setDepth(35);

          this.drawShopEnvironment();
        }

        private ensureTexture(key: string, dataUrl: string): boolean {
          if (this.textures.exists(key)) {
            this.loadedKeys.add(key);
            return true;
          }
          if (this.loadingKeys.has(key)) return false;
          this.loadingKeys.add(key);
          const img = new Image();
          img.onload = () => {
            if (!this.sys || !this.textures) return;
            if (!this.textures.exists(key)) {
              this.textures.addImage(key, img);
            }
            this.loadedKeys.add(key);
            this.loadingKeys.delete(key);
          };
          img.onerror = () => {
            this.loadingKeys.delete(key);
          };
          img.src = dataUrl;
          return false;
        }

        private drawShopEnvironment(): void {
          const b = bridgeRef.current;
          const eq = { ...DEFAULT_EQUIPPED, ...b.equipped };
          const styleKey = `${eq.env}|${eq.sign}|${eq.shelf}|${eq.decor}|${eq.counter}|${b.lang}|${b.sim.flag('fridge')}|${b.sim.flag('powerOut')}`;
          if (styleKey === this.lastStyleKey) return;
          this.lastStyleKey = styleKey;

          const envStyle = CUSTOMIZATION_MAP[eq.env]?.style ?? CUSTOMIZATION_MAP.env_para!.style;
          const signStyle = CUSTOMIZATION_MAP[eq.sign]?.style ?? CUSTOMIZATION_MAP.sign_default!.style;
          const shelfStyle = CUSTOMIZATION_MAP[eq.shelf]?.style ?? CUSTOMIZATION_MAP.shelf_wood!.style;
          const decorStyle = CUSTOMIZATION_MAP[eq.decor]?.style ?? CUSTOMIZATION_MAP.decor_bulb!.style;
          const counterStyle = CUSTOMIZATION_MAP[eq.counter]?.style ?? CUSTOMIZATION_MAP.counter_wood!.style;

          const numColor = (hex: string): number => parseInt(hex.replace('#', ''), 16);

          const g = this.bgGfx;
          g.clear();

          // Back wall
          g.fillStyle(numColor(envStyle.primary), 1);
          g.fillRect(0, 0, W, H);
          g.fillStyle(numColor(envStyle.secondary), 0.55);
          g.fillRect(0, 0, W, 62);

          // Storage door on far left
          g.fillStyle(0x6d4c41, 1);
          g.lineStyle(3, 0x3b2314, 1);
          g.fillRoundedRect(14, 78, 72, 138, 8);
          g.strokeRoundedRect(14, 78, 72, 138, 8);
          g.fillStyle(0xf6c445, 1);
          g.fillCircle(74, 148, 5);

          // Back wall product shelves
          g.fillStyle(numColor(shelfStyle.primary), 1);
          g.fillRoundedRect(102, 66, 336, 146, 8);
          g.strokeRoundedRect(102, 66, 336, 146, 8);
          for (const sy of [108, 152, 196]) {
            g.fillStyle(numColor(shelfStyle.secondary), 1);
            g.fillRect(108, sy, 324, 10);
            // Decorative mini jars/packets on the back wall
            const colors = [0xf6c445, 0xe63946, 0x2a9d8f, 0xf4a261, 0x3a86ff, 0xec4899];
            for (let k = 0; k < 8; k++) {
              g.fillStyle(colors[(k + sy) % colors.length]!, 0.9);
              g.fillRoundedRect(118 + k * 39, sy - 24, 24, 22, 4);
              g.lineStyle(2, 0x3b2314, 0.8);
              g.strokeRoundedRect(118 + k * 39, sy - 24, 24, 22, 4);
            }
          }

          // Refrigerator next to shelves
          const fridgeBroken = b.sim.flag('fridge');
          g.fillStyle(fridgeBroken ? 0xfca5a5 : 0xe0f2fe, 1);
          g.lineStyle(3, 0x3b2314, 1);
          g.fillRoundedRect(450, 68, 78, 144, 8);
          g.strokeRoundedRect(450, 68, 78, 144, 8);
          g.fillStyle(fridgeBroken ? 0xef4444 : 0xbae6fd, 0.7);
          g.fillRoundedRect(458, 78, 62, 118, 5);

          // Top Signboard
          g.fillStyle(numColor(signStyle.primary), 1);
          g.lineStyle(4, 0x3b2314, 1);
          g.fillRoundedRect(W / 2 - 165, 6, 330, 40, 10);
          g.strokeRoundedRect(W / 2 - 165, 6, 330, 40, 10);
          g.lineStyle(2, numColor(signStyle.secondary), 1);
          g.strokeRoundedRect(W / 2 - 159, 11, 318, 30, 7);

          const banner = signStyle.bannerText ? pick(signStyle.bannerText, b.lang) : 'বিসমিল্লাহ স্টোর';
          this.signText.setText(banner);

          // Festive bunting / fairy lights if unlocked
          if (eq.decor !== 'decor_bulb') {
            const cols = [numColor(decorStyle.primary), numColor(decorStyle.secondary), numColor(decorStyle.accent)];
            for (let x = 24; x < W - 24; x += 36) {
              g.fillStyle(cols[(x / 36) % cols.length]!, 1);
              g.fillTriangle(x, 48, x + 18, 48, x + 9, 64);
            }
          }

          // Foreground Shop Counter
          g.fillStyle(numColor(counterStyle.primary), 1);
          g.lineStyle(4, 0x3b2314, 1);
          g.fillRoundedRect(0, 224, W, 76, 4);
          g.strokeRoundedRect(0, 224, W, 76, 4);
          g.fillStyle(numColor(counterStyle.accent), 1);
          g.fillRect(4, 226, W - 8, 12);

          // Calculator & Khata on the counter
          const calcDead = b.sim.flag('powerOut');
          g.fillStyle(calcDead ? 0x7f1d1d : 0x1e293b, 1);
          g.fillRoundedRect(530, 200, 44, 30, 5);
          g.strokeRoundedRect(530, 200, 44, 30, 5);
          g.fillStyle(calcDead ? 0xef4444 : 0x86efac, 1);
          g.fillRect(536, 205, 32, 10);

          // Red Halkhata Ledger Book on counter
          g.fillStyle(0xc9462c, 1);
          g.fillRoundedRect(658, 206, 46, 26, 4);
          g.strokeRoundedRect(658, 206, 46, 26, 4);
        }

        private spawnPopup(x: number, y: number, text: string, color: string): void {
          const t = this.add
            .text(x, y, text, {
              fontFamily: "'Baloo Da 2','Hind Siliguri',sans-serif",
              fontSize: '18px',
              fontStyle: 'bold',
              color,
              stroke: '#3B2314',
              strokeThickness: 4,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(45);
          this.tweens.add({
            targets: t,
            y: y - 38,
            alpha: 0,
            duration: 850,
            ease: 'Cubic.Out',
            onComplete: () => t.destroy(),
          });
        }

        override update(time: number): void {
          const b = bridgeRef.current;
          const s = b.sim;
          this.drawShopEnvironment();

          // Drain queued events for visual reactions & floating popups
          while (b.queueEvents.length > 0) {
            const ev = b.queueEvents.shift()!;
            if (ev.t === 'served') {
              this.keeperExpr = 'happy';
              this.keeperExprUntil = time + 1200;
              this.spawnPopup(580, 130, `+${ev.points}`, '#F6C445');
            } else if (ev.t === 'tapBad' || ev.t === 'payBad') {
              this.keeperExpr = 'surprised';
              this.keeperExprUntil = time + 900;
              this.spawnPopup(580, 145, b.lang === 'bn' ? 'ভুল!' : 'Oops!', '#EF4444');
            } else if (ev.t === 'lost') {
              this.keeperExpr = 'sad';
              this.keeperExprUntil = time + 1200;
            } else if (ev.t === 'cash' && ev.delta !== 0) {
              const sign = ev.delta > 0 ? '+' : '−';
              this.spawnPopup(550, 190, `${sign}৳${Math.abs(ev.delta)}`, ev.delta > 0 ? '#22C55E' : '#F97316');
            }
          }

          if (time > this.keeperExprUntil && this.keeperExpr !== 'neutral') {
            this.keeperExpr = 'neutral';
          }

          // Update ceiling fan rotation
          this.fanGfx.clear();
          const fanAngle = (time * 0.006) % (Math.PI * 2);
          this.fanGfx.lineStyle(3, 0x3b2314, 1);
          this.fanGfx.fillStyle(0xd97706, 1);
          for (let i = 0; i < 3; i++) {
            const a = fanAngle + (i * Math.PI * 2) / 3;
            const bx = 95 + Math.cos(a) * 26;
            const by = 32 + Math.sin(a) * 8;
            this.fanGfx.lineBetween(95, 32, bx, by);
          }
          this.fanGfx.fillCircle(95, 32, 6);

          // Update Shopkeeper sprite
          const outfit = b.equipped.outfit || DEFAULT_EQUIPPED.outfit;
          const skKey = `sk:${outfit}:${this.keeperExpr}`;
          if (this.ensureTexture(skKey, shopkeeperDataUrl(outfit, this.keeperExpr))) {
            this.shopkeeperImg.setTexture(skKey).setDisplaySize(108, 142).setAlpha(1);
            this.shopkeeperImg.setY(186 + Math.sin(time * 0.004) * 2.5);
          }

          // Boss character presence
          if (s.cfg.boss && s.boss) {
            const bossMeta = BOSS_NAMES[s.cfg.boss.id];
            const bKey = `char:${bossMeta.look}:angry`;
            if (this.ensureTexture(bKey, characterDataUrl(bossMeta.look, 'angry'))) {
              if (!this.bossImg) {
                this.bossImg = this.add.image(62, 162, bKey).setDisplaySize(105, 138).setDepth(14);
              } else {
                this.bossImg.setTexture(bKey).setDisplaySize(105, 138).setVisible(true);
              }
              this.bossImg.setY(160 + Math.sin(time * 0.006) * 4);
            }
          } else if (this.bossImg) {
            this.bossImg.setVisible(false);
          }

          // Sync Customer Slots (slots 0, 1, 2)
          const slotX = [175, 315, 455];
          const activeIds = new Set<number>();

          for (const c of s.customers) {
            if (c.slot < 0 || c.slot > 2 || c.state === 'gone') continue;
            activeIds.add(c.id);
            let entry = this.slotContainers.get(c.id);
            if (!entry) {
              const container = this.add.container(slotX[c.slot] ?? 200, 185).setDepth(18);
              const ringGfx = this.add.graphics();
              const sprite = this.add.image(0, 0, '__DEFAULT').setDisplaySize(104, 136).setAlpha(0);
              const barGfx = this.add.graphics();
              const tagText = this.add
                .text(0, 58, '', {
                  fontFamily: "'Baloo Da 2','Hind Siliguri',sans-serif",
                  fontSize: '12px',
                  fontStyle: 'bold',
                  color: '#FFFFFF',
                  backgroundColor: '#3B2314',
                  padding: { x: 6, y: 2 },
                })
                .setOrigin(0.5, 0.5);

              sprite.setInteractive({ useHandCursor: true });
              const cid = c.id;
              sprite.on('pointerdown', () => {
                bridgeRef.current.onSelectCustomer(cid);
              });

              container.add([ringGfx, sprite, barGfx, tagText]);
              entry = { container, sprite, barGfx, ringGfx, tagText, texKey: '' };
              this.slotContainers.set(c.id, entry);
            }

            const expr: Expression =
              c.state === 'satisfied'
                ? 'happy'
                : c.state === 'angry' || c.state === 'lostPatience' || c.state === 'complaining'
                  ? 'angry'
                  : c.patience * 4 < c.patienceMax
                    ? 'sad'
                    : c.state === 'ordering' || c.state === 'deciding'
                      ? 'talk'
                      : 'neutral';

            const texKey = `char:${c.look}:${expr}`;
            if (this.ensureTexture(texKey, characterDataUrl(c.look, expr))) {
              if (entry.texKey !== texKey) {
                entry.sprite.setTexture(texKey).setDisplaySize(104, 136).setAlpha(1);
                entry.texKey = texKey;
              }
            }

            const targetX = slotX[c.slot] ?? 200;
            const bob = Math.sin(time * 0.005 + c.id) * 3;
            entry.container.setPosition(targetX, 178 + bob);

            // Selection glow ring
            entry.ringGfx.clear();
            const isSelected = s.selected === c.id;
            if (isSelected) {
              entry.ringGfx.lineStyle(4, 0xf6c445, 1);
              entry.ringGfx.fillStyle(0xf6c445, 0.18);
              entry.ringGfx.fillCircle(0, 6, 54);
              entry.ringGfx.strokeCircle(0, 6, 54);
            }

            // Patience bar above customer head
            entry.barGfx.clear();
            const ratio = Math.max(0, Math.min(1, c.patience / Math.max(1, c.patienceMax)));
            const barColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
            entry.barGfx.fillStyle(0x1f2937, 0.9);
            entry.barGfx.fillRoundedRect(-36, -74, 72, 10, 4);
            entry.barGfx.fillStyle(barColor, 1);
            entry.barGfx.fillRoundedRect(-34, -72, Math.max(4, Math.floor(68 * ratio)), 6, 3);

            const stateLabel =
              c.state === 'paying'
                ? b.lang === 'bn'
                  ? '৳ বিল'
                  : '৳ Pay'
                : isSelected
                  ? b.lang === 'bn'
                    ? '▼ কাস্টমার'
                    : '▼ Active'
                  : '';
            entry.tagText.setText(stateLabel).setVisible(Boolean(stateLabel));
          }

          for (const [cid, entry] of this.slotContainers.entries()) {
            if (!activeIds.has(cid)) {
              entry.container.destroy();
              this.slotContainers.delete(cid);
            }
          }

          // Sync interactive scene hotspots
          const activeHotspots = new Set<number>();
          s.hotspots.forEach((h, idx) => {
            activeHotspots.add(h.id);
            let hObj = this.hotspotObjs.get(h.id);
            const info = hotspotBadgeInfo(h.kind, h.seq, h.taps);
            const hx = 110 + ((h.pos + idx * 130) % 480);
            const hy = h.kind === 'box' || h.kind === 'flood' ? 255 : 95 + (h.pos % 70);

            if (!hObj) {
              const container = this.add.container(hx, hy).setDepth(38);
              const bg = this.add.graphics();
              const label = this.add
                .text(0, 0, '', {
                  fontFamily: "'Baloo Da 2','Hind Siliguri',sans-serif",
                  fontSize: '13px',
                  fontStyle: 'bold',
                  color: '#FFFFFF',
                })
                .setOrigin(0.5, 0.5);
              bg.fillStyle(parseInt(info.color.slice(1), 16), 1);
              bg.lineStyle(3, 0x3b2314, 1);
              bg.fillRoundedRect(-52, -16, 104, 32, 12);
              bg.strokeRoundedRect(-52, -16, 104, 32, 12);
              const hitZone = this.add.zone(0, 0, 108, 36).setInteractive({ useHandCursor: true });
              const hid = h.id;
              hitZone.on('pointerdown', () => {
                bridgeRef.current.onTapHotspot(hid);
              });
              container.add([bg, label, hitZone]);
              hObj = { container, bg, label };
              this.hotspotObjs.set(h.id, hObj);
            }
            hObj.label.setText(`${info.emoji} ${b.lang === 'bn' ? info.labelBn : info.labelEn}`);
            hObj.container.setScale(1 + Math.sin(time * 0.01 + h.id) * 0.05);
          });

          for (const [hid, hObj] of this.hotspotObjs.entries()) {
            if (!activeHotspots.has(hid)) {
              hObj.container.destroy();
              this.hotspotObjs.delete(hid);
            }
          }

          // Weather & Emergency overlays (Rain, Load-shedding darkness, Fire smoke)
          this.weatherGfx.clear();
          if (s.flag('rain')) {
            this.weatherGfx.lineStyle(2, 0x60a5fa, 0.45);
            const offset = Math.floor(time * 0.4) % 40;
            for (let x = 10; x < W; x += 45) {
              for (let y = -20 + offset; y < H; y += 45) {
                this.weatherGfx.lineBetween(x, y, x - 8, y + 18);
              }
            }
          }

          this.overlayGfx.clear();
          if (s.flag('dark')) {
            this.overlayGfx.fillStyle(0x090d16, 0.68);
            this.overlayGfx.fillRect(0, 0, W, H);
          }
          if (s.flag('fire')) {
            const pulse = 0.15 + Math.abs(Math.sin(time * 0.008)) * 0.2;
            this.overlayGfx.fillStyle(0xdc2626, pulse);
            this.overlayGfx.fillRect(0, 0, W, H);
          }
        }
      }

      gameInstance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: W,
        height: H,
        backgroundColor: '#FFF3D6',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
        },
        scene: [DokaanScene],
        audio: { noAudio: true },
        banner: false,
      });
    }

    boot();

    return () => {
      destroyed = true;
      if (gameInstance) {
        gameInstance.destroy(true);
        gameInstance = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="phaser-shop-stage"
      className="w-full overflow-hidden rounded-xl border-2 border-[#3B2314] bg-[#FFF3D6] shadow-inner"
      style={{ aspectRatio: '720 / 300', maxHeight: '220px' }}
    />
  );
}
