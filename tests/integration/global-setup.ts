import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execSync } from 'node:child_process';

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(600);
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => {
      sock.destroy();
      resolve(false);
    });
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, '127.0.0.1');
  });
}

export default async function setup(): Promise<() => Promise<void>> {
  const port = 54329;
  const dbDir = path.resolve(__dirname, '../../.pgdata/test-utf8');
  const dbUrl = `postgresql://dokaan:dokaan@localhost:${port}/dokaan?schema=public`;
  process.env.DATABASE_URL = dbUrl;

  let pgInstance: { stop: () => Promise<void> } | null = null;
  const alreadyUp = await isPortOpen(port);

  if (!alreadyUp) {
    try {
      const pidFile = path.join(dbDir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        fs.rmSync(pidFile, { force: true });
      }
      const mod = await import('embedded-postgres');
      const EmbeddedPostgres = mod.default ?? mod;
      const pg = new EmbeddedPostgres({
        databaseDir: dbDir,
        user: 'dokaan',
        password: 'dokaan',
        port,
        persistent: true,
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
      });
      if (!fs.existsSync(path.join(dbDir, 'PG_VERSION'))) {
        await pg.initialise();
      }
      await pg.start();
      try {
        await pg.createDatabase('dokaan');
      } catch {
        // already exists
      }
      pgInstance = pg;
    } catch (err) {
      console.warn('EmbeddedPostgres setup warning:', err);
    }
  }

  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
  } catch {
    // ignore if db is not running
  }

  return async () => {
    if (pgInstance) {
      try {
        await Promise.race([
          pgInstance.stop(),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
      } catch {
        // ignore
      }
    }
  };
}
