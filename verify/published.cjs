'use strict';
// Compare the deployed files with the committed Git blobs, including images/fonts.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const ARTICLE = process.env.ARTICLE_URL || 'https://starrysea1412.github.io/vol24-skill-mcp/';
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const gitBlob = (dir, file) => execFileSync('git', ['show', 'HEAD:' + file], { cwd: dir });
const commit = dir => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

async function inspect(base, dir, file) {
  const url = new URL(file, base);
  const expected = gitBlob(dir, file);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
  const actual = Buffer.from(await response.arrayBuffer());
  return { file, url: url.href, status: response.status, bytes: actual.length,
    sha256: hash(actual), expectedSha256: hash(expected), diff: actual.equals(expected) ? 0 : 1,
    passed: response.ok && actual.equals(expected) };
}

async function mapBounded(items, operation, workers = 4) {
  let cursor = 0;
  const output = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try { output[index] = await operation(items[index]); }
      catch (error) { output[index] = { ...items[index], passed: false, error: error.message }; }
    }
  }));
  return output;
}

(async () => {
  const html = gitBlob(ROOT, 'index.html').toString('utf8');
  const css = gitBlob(ROOT, 'style.css').toString('utf8');
  const localPaths = new Set(['index.html', 'style.css', 'demos.js']);
  for (const match of html.matchAll(/\b(?:src|srcset|href)="([^"]+)"/g)) {
    const file = match[1];
    if (!file.startsWith('#') && !/^(?:https?:|data:)/.test(file)) localPaths.add(file);
  }
  for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (!match[1].startsWith('data:')) localPaths.add(match[1]);
  }
  const jobs = Array.from(localPaths, file => ({ base: ARTICLE, dir: ROOT, file }));
  const sites = [{ name: 'vol24-skill-mcp', url: ARTICLE, commit: commit(ROOT) }];
  if (!process.argv.includes('--article-only')) {
    for (const name of ['vol23-linger', 'makers-notebook']) {
      const dir = path.resolve(ROOT, '..', name);
      if (!fs.existsSync(path.join(dir, '.git'))) continue;
      const base = `https://starrysea1412.github.io/${name}/`;
      jobs.push({ base, dir, file: 'index.html' });
      sites.push({ name, url: base, commit: commit(dir) });
    }
  }
  const files = await mapBounded(jobs, job => inspect(job.base, job.dir, job.file));
  const passed = files.every(file => file.passed);
  const result = { checkedAtUtc: new Date().toISOString(), passed, filesCompared: files.length,
    diff: passed ? 0 : files.filter(file => !file.passed).length, sites, files };
  fs.writeFileSync(path.join(__dirname, 'publication.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed, filesCompared: result.filesCompared, diff: result.diff,
    failures: files.filter(file => !file.passed).map(file => ({ url: file.url, status: file.status, error: file.error })) }));
  process.exitCode = passed ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
