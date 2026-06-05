import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viteDist = path.join(root, 'dist');
const stagingRoot = path.join(root, '.sites-build');
const stagedDist = path.join(stagingRoot, 'dist');
const publicDir = path.join(stagedDist, 'server', 'public');
const serverDir = path.join(stagedDist, 'server');
const metadataDir = path.join(stagedDist, '_appgen_meta');

if (!existsSync(path.join(viteDist, 'index.html'))) {
  throw new Error('Run npm run build before preparing the Sites artifact.');
}

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(viteDist, publicDir, { recursive: true });
await writeFile(path.join(serverDir, 'index.js'), workerSource(), 'utf8');

await mkdir(metadataDir, { recursive: true });
await cp(path.join(root, '.openai', 'hosting.json'), path.join(metadataDir, 'appgarden.json'));

console.log(`Prepared Sites artifact at ${stagedDist}`);

function workerSource() {
  return `export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response("Static asset binding unavailable.", { status: 500 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      return response;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
`;
}
