import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_VERSION, validateConfig } from '../src/content/builder';
import { CHAPTERS, LEVEL_ROWS, storyConfig, TOTAL_LEVELS } from '../src/content/levels';
import { CHALLENGES } from '../src/content/challenges';
import { PRODUCTS, TABS } from '../src/content/products';
import { ACHIEVEMENTS } from '../src/content/achievements';
import { CUSTOMIZATION_ITEMS } from '../src/content/customization';

const levels = [];
for (let n = 1; n <= TOTAL_LEVELS; n++) {
  const cfg = storyConfig(n);
  const errs = validateConfig(cfg);
  if (errs.length > 0) {
    throw new Error(`Level ${n} failed validation: ${errs.join(', ')}`);
  }
  levels.push(cfg);
}

const pack = {
  version: CONTENT_VERSION,
  generatedAt: new Date().toISOString(),
  chapters: CHAPTERS,
  levelRows: LEVEL_ROWS,
  levels,
  challenges: CHALLENGES,
  products: PRODUCTS,
  tabs: TABS,
  achievements: ACHIEVEMENTS.map(({ id, name, description, icon, target, reward }) => ({
    id,
    name,
    description,
    icon,
    target,
    reward,
  })),
  customizations: CUSTOMIZATION_ITEMS,
};

const outPath = path.resolve(__dirname, '../public/content-pack.json');
fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), 'utf8');
console.log(`Built content pack v${CONTENT_VERSION} (${levels.length} levels, ${CHALLENGES.length} challenges) -> ${outPath}`);
