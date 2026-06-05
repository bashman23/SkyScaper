import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const adsenseClientId = readEnv('VITE_ADSENSE_CLIENT_ID');
const siteOrigin = normalizeOrigin(readEnv('VITE_SITE_ORIGIN'));

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, 'ads.txt'), createAdsTxt(adsenseClientId), 'utf8');
await writeFile(path.join(publicDir, 'sitemap.xml'), createSitemap(siteOrigin), 'utf8');

function readEnv(key) {
  return process.env[key] || readLocalEnv(key) || '';
}

function readLocalEnv(key) {
  try {
    const envPath = path.join(root, '.env');
    const contents = readFileSync(envPath, 'utf8');
    const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

function createAdsTxt(clientId) {
  const publisherId = clientId.replace(/^ca-/, '').trim();
  if (!/^pub-[a-zA-Z0-9_-]+$/.test(publisherId)) {
    return '# Configure VITE_ADSENSE_CLIENT_ID to generate a production Google AdSense ads.txt entry.\n';
  }

  return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
}

function createSitemap(origin) {
  const routes = ['/', '/guide', '/about', '/privacy', '/terms', '/contact'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${origin}${route}</loc>
  </url>`
  )
  .join('\n')}
</urlset>
`;
}

function normalizeOrigin(origin) {
  const fallback = 'https://map-measurement.example.com';
  if (!origin) {
    return fallback;
  }

  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return fallback;
  }
}
