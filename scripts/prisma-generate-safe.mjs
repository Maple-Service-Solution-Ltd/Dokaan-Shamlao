import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const clientDir = path.resolve(process.cwd(), 'node_modules/.prisma/client');

// Clean up any leftover .tmp files from interrupted Windows runs
if (fs.existsSync(clientDir)) {
  for (const name of fs.readdirSync(clientDir)) {
    if (name.includes('.tmp')) {
      try {
        fs.unlinkSync(path.join(clientDir, name));
      } catch {
        // ignore
      }
    }
  }
}

const res = spawnSync('npx', ['prisma', 'generate'], {
  encoding: 'utf8',
  shell: true,
});

if (res.status === 0) {
  process.stdout.write(res.stdout || '');
  process.exit(0);
}

const combined = `${res.stdout || ''}\n${res.stderr || ''}`;
const dllPath = path.join(clientDir, 'query_engine-windows.dll.node');
const indexPath = path.join(clientDir, 'index.js');

if (combined.includes('EPERM') && fs.existsSync(dllPath) && fs.existsSync(indexPath)) {
  console.log('✔ Prisma Client is already generated and loaded in memory (skipping locked Windows DLL overwrite).');
  process.exit(0);
}

process.stderr.write(combined);
process.exit(res.status ?? 1);
