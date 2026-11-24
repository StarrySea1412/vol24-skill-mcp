import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

// User-selected local Huajing HTTP API. No keys are read or copied by this script.
// Run: node research/generate-images.mjs run
// Read saved status: node research/generate-images.mjs status
// Resume uses saved job IDs before considering another submission.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = process.env.SKILL_MCP_IMAGE_API || 'http://127.0.0.1:4173';
const generatedDir = process.env.SKILL_MCP_GENERATED_DIR || 'D:/project/ai-image-studio/data/generated';
const sharpModuleRoot = process.env.SKILL_MCP_SHARP_ROOT || 'D:/project/ai-image-studio/package.json';
const requireImage = createRequire(sharpModuleRoot);
const sharp = requireImage('sharp');
const recordPath = path.join(projectRoot, 'research', 'image-generation.json');
const originalsDir = path.join(projectRoot, 'research', 'image-originals');
const assetsDir = path.join(projectRoot, 'assets');
const channels = [
  { id: '2eb4cff3-6ded-4d22-8ae9-2258e32c3672', name: '噜皮生图', model: 'gpt-image-2.5-sunburst' },
  { id: '084a283c-8fe9-4d28-84fa-92f5f5c3bc41', name: 'crz', model: 'gpt-image-2' },
];

const style = `Use case: illustration-story. Asset type: editorial illustration for an interactive Chinese engineering article.
Style/medium: refined hand-drawn ink lines and delicate muted watercolor washes on warm off-white paper (#f7f4ec), with precise navy (#2c4a7c) and charcoal ink (#23282a), sparse restrained amber (#a95f16), fine subtle paper grain. Calm, carefully observed practical objects, understated engineering field-notes aesthetic, soft natural studio light. This is the same small botanical illustration studio across five companion images.
Composition/framing: landscape 3:2; give each object enough space; keep all main objects within the central 80 percent and keep complete objects visible. Polished but quiet editorial composition, believable materials and consistent perspective.
Constraints: conceptual editorial artwork, not a screenshot or a measured experiment. No text, no lettering, no numbers, no logos, no watermark. No glossy 3D, no generic glowing AI brain, no mystical effects. Do not invent extra narrative objects or people.`;

const scenes = [
  { slug: '01-paths', title: '三种入口', scene: `Primary request: A top-down view of one small illustration studio desk. An unfinished botanical drawing lies at the center. Three distinct practical ways of reaching the same task sit around it: a terminal-like mechanical keypad, an open step-by-step notebook with simple pictograms, and a neat modular cable connector next to the notebook. Three separate thin colored cords reach the same drawing holder, clearly distinct and never tangled. The notebook does not depend physically on the connector; each route remains visibly separate. The image should communicate multiple ways to carry out the same work, not a hierarchy of intelligence. No readable text anywhere.` },
  { slug: '02-progressive', title: '按需打开', scene: `Primary request: Close view of a paper index card standing in front of an instruction notebook. The notebook is partly open, revealing a few illustrated process pages. Behind it, a reference folder and one compact practical tool are still on a shelf. Show a deliberate sequence from a tiny index card to the notebook, then to only one selected reference sheet; the remaining sheets stay closed. The composition should convey reading only what is needed rather than dumping all papers onto the desk. Use only simple pictograms where marks are needed; no readable text or numbers.` },
  { slug: '03-contract', title: '参数契约', scene: `Primary request: A careful close-up of two modular connector pieces on a cream paper workbench. One has three precisely shaped recesses; a matching plug aligns cleanly with them. Beside it, a mismatched extra-large plug rests visibly aside and does not fit. A small drawing request card and a plain mechanical inspection gauge are nearby. This is an understated engineering editorial illustration about a declared interface and invalid arguments. No human hands are needed. No readable text, no lettering.` },
  { slug: '04-ticket', title: '同一张任务票', scene: `Primary request: A studio print rack with one blank cream task ticket clipped to a wire leading through three modest workstations: an incoming tray, a drawing machine at work, and a finished botanical illustration drying rack. A small desk clock in the foreground has stopped, while the machine behind it is visibly continuing its work. One continuous ticket route, exactly one task ticket, no duplicated ticket. Communicate that a watcher timing out does not mean the work stopped. No readable text or numbers on the ticket or clock.` },
  { slug: '05-inspect', title: '打开再交付', scene: `Primary request: A finished botanical illustration on a small studio light table, checked with a ruler and a clean magnifying glass. A sealed blank envelope and an empty frame sit aside, showing that receiving a container alone is not enough; the actual picture is laid out and inspected. The image should emphasize a useful readable picture with deliberate framing, calm precise workmanship and a final check of dimensions. The ruler may have simple tick marks but no numerals. No readable text, no logos, no watermark.` },
];

let records;
try { records = JSON.parse(await fs.readFile(recordPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  records = {
    article: '把流程接上工具',
    date: '2026-11-24',
    method: 'User-selected Huajing HTTP API: POST /api/generations, then GET /api/generations/{id}',
    apiBase,
    style,
    requestedSize: '1536x1024',
    countPerSubmission: 1,
    polishPrompt: false,
    finalEncoding: { format: 'webp', quality: 82, maxLongEdge: 1536, fit: 'inside', cropping: false },
    maxActiveJobs: 2,
    maxAttemptsPerImage: 3,
    assets: scenes.map(({ slug, title, scene }) => ({ slug, title, prompt: `${scene}\n\n${style}`, status: 'pending', attempts: [] })),
  };
}

let persistQueue = Promise.resolve();
function persist() {
  records.updatedAt = new Date().toISOString();
  const snapshot = JSON.stringify(records, null, 2) + '\n';
  persistQueue = persistQueue.then(() => fs.writeFile(recordPath, snapshot, 'utf8'));
  return persistQueue;
}

function safeText(value) {
  return String(value ?? '').replace(/Bearer\s+[^\s]+|(?:sk-|clh_)[A-Za-z0-9_-]+/gi, '[redacted]').slice(0, 650);
}

async function api(route, { method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(safeText(payload?.error?.message || payload?.message || `HTTP ${response.status}`));
  return payload;
}

function report(item, extra = {}) {
  console.log(JSON.stringify({ slug: item.slug, status: item.status, ...extra }));
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function saveImage(item, attempt, row) {
  const image = row.images?.[0];
  if (!image) throw new Error('Completed job returned no image');
  let bytes;
  let sourceFile;
  if (image.file) {
    sourceFile = path.join(generatedDir, path.basename(image.file));
    bytes = await fs.readFile(sourceFile);
  } else if (image.url) {
    const localImageUrl = new URL(image.url, apiBase);
    if (!['127.0.0.1', 'localhost'].includes(localImageUrl.hostname)) throw new Error('Image URL is not local Huajing media');
    const response = await fetch(localImageUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Local image HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } else { throw new Error('No local image file or URL in completed job'); }
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error('Image decoder returned no dimensions');
  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
  const originalPath = path.join(originalsDir, `${item.slug}-attempt-${attempt.number}-${attempt.jobId}.${extension}`);
  const finalPath = path.join(assetsDir, `${item.slug}.webp`);
  await fs.writeFile(originalPath, bytes, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  if (await exists(finalPath)) throw new Error('Refusing to overwrite an existing final asset without a saved completed record');
  const finalInfo = await sharp(bytes).rotate().resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(finalPath);
  item.status = 'completed';
  item.selectedAttempt = attempt.number;
  item.original = { path: originalPath, sourceFile, format: metadata.format, width: metadata.width, height: metadata.height, bytes: bytes.length };
  item.final = { path: finalPath, format: 'webp', width: finalInfo.width, height: finalInfo.height, bytes: finalInfo.size, quality: 82, cropping: false };
  item.completedAt = new Date().toISOString();
  await persist();
  report(item, { path: finalPath, width: finalInfo.width, height: finalInfo.height, bytes: finalInfo.size, model: attempt.model });
}

async function processItem(item) {
  if (item.status === 'completed' && item.final && await exists(item.final.path)) { report(item, { existing: true }); return; }
  let lastStatus;
  while (item.attempts.length < records.maxAttemptsPerImage || item.attempts.at(-1)?.status === 'running') {
    let attempt = item.attempts.at(-1);
    if (!attempt || attempt.status !== 'running') {
      if (item.attempts.length) await delay(45000);
      const channel = channels[item.attempts.length === 0 ? 0 : 1];
      attempt = { number: item.attempts.length + 1, providerId: channel.id, providerName: channel.name, model: channel.model, requestedSize: records.requestedSize, submittedAt: new Date().toISOString(), status: 'submitting' };
      item.attempts.push(attempt);
      item.status = 'submitting';
      await persist();
      try {
        const payload = await api('/api/generations', { method: 'POST', body: { prompt: item.prompt, title: `把流程接上工具 · ${item.title}`, providerId: channel.id, model: channel.model, size: records.requestedSize, count: 1, tags: ['article-skill-mcp', item.slug] } });
        const created = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        if (!created?.id) throw new Error('Submission returned no job ID');
        attempt.jobId = created.id;
        attempt.status = 'running';
        item.status = created.status || 'queued';
        await persist();
        report(item, { jobId: attempt.jobId, attempt: attempt.number, model: attempt.model });
      } catch (error) {
        // A transport failure may hide an accepted POST. Do not create a duplicate.
        attempt.status = 'submission_unknown';
        attempt.error = safeText(error.message);
        item.status = 'needs_submission_check';
        await persist();
        report(item, { error: attempt.error });
        return;
      }
    }
    const pollStart = Date.now();
    let settled = false;
    while (Date.now() - pollStart < 9 * 60 * 1000) {
      let row;
      try { row = (await api(`/api/generations/${encodeURIComponent(attempt.jobId)}`)).data; }
      catch (error) { report(item, { pollingError: safeText(error.message) }); await delay(20000); continue; }
      item.status = row.status;
      if (row.status !== lastStatus) {
        lastStatus = row.status;
        await persist();
        report(item, { jobId: attempt.jobId });
      }
      if (row.status === 'completed') {
        attempt.status = 'completed';
        attempt.completedAt = row.completedAt || new Date().toISOString();
        try { await saveImage(item, attempt, row); }
        catch (error) { item.status = 'image_copy_failed'; item.copyError = safeText(error.message); await persist(); report(item, { error: item.copyError }); }
        return;
      }
      if (['failed', 'cancelled'].includes(row.status)) {
        attempt.status = row.status;
        attempt.error = safeText(row.error?.message || row.error?.code || row.status);
        attempt.completedAt = new Date().toISOString();
        await persist();
        report(item, { error: attempt.error, attempt: attempt.number, model: attempt.model });
        settled = true;
        break;
      }
      await delay(20000);
    }
    if (!settled) {
      item.status = 'still_running';
      await persist();
      report(item, { jobId: attempt.jobId, message: 'Polling window ended; saved ID must be queried before another submission.' });
      return;
    }
  }
  item.status = 'failed';
  await persist();
  report(item, { message: 'Three GPT attempts exhausted; no model-family downgrade.' });
}

const command = process.argv[2] || 'status';
if (command === 'status') {
  for (const item of records.assets) report(item, { attemptCount: item.attempts.length, jobId: item.attempts.at(-1)?.jobId, final: item.final });
} else if (command === 'run') {
  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  const health = await api('/api/health');
  if (!health.ok) throw new Error('Local Huajing health did not confirm readiness');
  records.serviceVersion = health.version;
  await persist();
  const pending = [...records.assets];
  async function worker() {
    while (pending.length) {
      const item = pending.shift();
      if (item.status === 'needs_submission_check') { report(item, { message: 'Manual ID reconciliation required before resubmission.' }); continue; }
      await processItem(item);
    }
  }
  await Promise.allSettled(Array.from({ length: records.maxActiveJobs }, worker)).then(results => {
    for (const result of results) if (result.status === 'rejected') console.error(safeText(result.reason?.message || result.reason));
  });
  await persist();
  console.log(JSON.stringify({ completed: records.assets.filter(item => item.status === 'completed').length, total: records.assets.length, recordPath }));
  if (records.assets.some(item => item.status !== 'completed')) process.exitCode = 1;
} else { throw new Error('Use run or status'); }
