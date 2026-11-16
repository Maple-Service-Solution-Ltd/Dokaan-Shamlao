import { describe, expect, it } from 'vitest';
import { ALL_KEYS, digits, num, taka, t, tokens } from '@/lib/i18n';
import { PRODUCTS, PRODUCT_MAP, TABS } from '@/content/products';
import { ARCHETYPES } from '@/content/archetypes';
import { CHALLENGES, CHALLENGE_MAP, CATEGORY_NAMES } from '@/content/challenges';
import { ACHIEVEMENTS, EMPTY_LIFETIME_STATS, evaluateAchievements, mergeRunIntoLifetime } from '@/content/achievements';
import { CUSTOMIZATION_CATEGORIES, CUSTOMIZATION_ITEMS, levelFromXp } from '@/content/customization';
import { CHARACTERS, EXPRESSIONS, characterSvg, faceSvg } from '@/game/art/characters';
import { productSvg } from '@/game/art/products';
import { fullCharacterSvg, noteSvg } from '@/game/art/shop';
import { storyConfig } from '@/content/levels';
import { Sim } from '@/core/sim';
import { botPlay, BOT_SKILLED } from '@/core/bot';

describe('Localization & i18n completeness', () => {
  it('has identical keys in Bangla (bn) and English (en)', () => {
    const bnKeys = [...ALL_KEYS.bn].sort();
    const enKeys = [...ALL_KEYS.en].sort();
    expect(enKeys).toEqual(bnKeys);
  });

  it('formats Bangla numerals, currency and token substitutions accurately', () => {
    expect(digits(12345, 'bn')).toBe('১২৩৪৫');
    expect(digits(12345, 'en')).toBe('12345');
    expect(taka(500, 'bn')).toBe('৳৫০০');
    expect(num(1000, 'en')).toBe('1,000');
    expect(tokens('#rice', 'bn')).toBe('চাল');
    expect(tokens('#rice', 'en')).toBe('Rice');
    expect(t('ui.combo', 'bn', { n: 3 })).toContain('৩');
  });
});

describe('Products, Characters, Challenges, Achievements & Customizations', () => {
  it('validates all 38 Bangladeshi products and their SVG icons', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(35);
    const validTabs = new Set(TABS.map((tb) => tb.id));
    for (const p of PRODUCTS) {
      expect(PRODUCT_MAP[p.id]).toBeDefined();
      expect(p.sell).toBeGreaterThan(p.buy);
      expect(p.sell % 5).toBe(0);
      expect(validTabs.has(p.tab)).toBe(true);
      const svg = productSvg(p.icon);
      expect(svg.startsWith('<svg')).toBe(true);
    }
  });

  it('validates all character archetypes and SVG artwork generators', () => {
    for (const arch of Object.values(ARCHETYPES)) {
      expect(arch.looks.length).toBeGreaterThan(0);
      for (const look of arch.looks) {
        expect(CHARACTERS[look]).toBeDefined();
      }
    }
    for (const [id, spec] of Object.entries(CHARACTERS)) {
      const svg = characterSvg(spec);
      expect(svg).toContain('<svg');
      const full = fullCharacterSvg(id, 'happy');
      expect(full).toContain('<svg');
    }
    for (const expr of EXPRESSIONS) {
      expect(faceSvg(expr)).toContain('<svg');
    }
    expect(noteSvg(500, false, 0)).toContain('<svg');
    expect(noteSvg(500, true, 1)).toContain('<svg');
  });

  it('has at least 50 implemented challenges across all 7 required categories', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(60);
    const byCat: Record<string, number> = {};
    for (const ch of CHALLENGES) {
      expect(CHALLENGE_MAP[ch.id]).toBe(ch);
      expect(ch.name.bn.length).toBeGreaterThan(0);
      expect(ch.name.en.length).toBeGreaterThan(0);
      expect(ch.description.bn.length).toBeGreaterThan(0);
      expect(ch.howTo.bn.length).toBeGreaterThan(0);
      expect(ch.failure.bn.length).toBeGreaterThan(0);
      expect(ch.objectives.length).toBeGreaterThan(0);
      byCat[ch.category] = (byCat[ch.category] ?? 0) + 1;
    }
    for (const cat of Object.keys(CATEGORY_NAMES)) {
      expect(byCat[cat]).toBeGreaterThan(0);
    }
  });

  it('evaluates all 20 achievements deterministically after a level win', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
    const cfg = storyConfig(1);
    const sim = botPlay(new Sim(cfg), BOT_SKILLED);
    expect(sim.result?.won).toBe(true);
    const updatedLifetime = mergeRunIntoLifetime(EMPTY_LIFETIME_STATS, cfg, sim.result!);
    const { statuses, newlyUnlocked } = evaluateAchievements(
      { lifetime: updatedLifetime, storyStars: { '1': 3 } },
      [],
    );
    expect(statuses.length).toBe(ACHIEVEMENTS.length);
    expect(newlyUnlocked.some((a) => a.id === 'first_sale')).toBe(true);
  });

  it('covers all 6 customization categories and XP curve', () => {
    expect(CUSTOMIZATION_CATEGORIES.length).toBe(6);
    for (const cat of CUSTOMIZATION_CATEGORIES) {
      const items = CUSTOMIZATION_ITEMS.filter((i) => i.category === cat.id);
      expect(items.length).toBeGreaterThanOrEqual(4);
    }
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(250).level).toBeGreaterThan(1);
  });
});
