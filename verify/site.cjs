'use strict';

// Local: node verify/site.cjs. Preliminary: add --preliminary.
// Online: ARTICLE_URL=https://…/ node verify/site.cjs.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const RESULTS = path.join(__dirname, 'results.json');
const SHOTS = path.join(ROOT, 'shots');
const preliminary = process.argv.includes('--preliminary');
const online = Boolean(process.env.ARTICLE_URL);
const saveShots = !online || process.env.SAVE_ONLINE_SHOTS === '1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function loadPlaywright() {
  const candidates = [
    'playwright-core',
    'D:/project/git-primer/node_modules/playwright-core',
    'D:/project/ai-image-studio/node_modules/playwright-core'
  ];
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('playwright-core is unavailable. Set NODE_PATH to an installed package directory.');
}

async function serveLocal() {
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end('Bad URL'); return; }
    const candidate = path.resolve(ROOT, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (candidate !== ROOT && !candidate.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.stat(candidate, (statError, stat) => {
      if (statError || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(candidate).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(candidate).pipe(response);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

const report = {
  startedAt: new Date().toISOString(), phase: preliminary ? 'preliminary' : 'final',
  complete: false, target: null, browser: 'msedge', checks: [], errors: [],
  consoleErrors: [], failedResponses: [], failedRequests: [], screenshots: [], layouts: [], assets: []
};

function check(name, condition, details) {
  report.checks.push({ name, passed: Boolean(condition), ...(details === undefined ? {} : { details }) });
}

async function screenshot(page, name, selector) {
  if (!saveShots) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}.png`);
  if (selector) {
    const locator = page.locator(selector);
    await locator.scrollIntoViewIfNeeded();
    await locator.screenshot({ path: file, animations: 'disabled' });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  }
  report.screenshots.push(file);
}

async function auditLayout(page, label) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const outliers = [];
    for (const node of document.querySelectorAll('body *')) {
      if (node instanceof SVGElement) continue;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const style = getComputedStyle(node);
      if (style.position === 'fixed' || style.visibility === 'hidden') continue;
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      // A table or code line may intentionally extend inside its own horizontal scroller.
      if (node.closest('.table-wrap, pre')) continue;
      outliers.push({
        tag: node.tagName.toLowerCase(), id: node.id || null,
        className: typeof node.className === 'string' ? node.className : null,
        left: Math.round(rect.left * 100) / 100, right: Math.round(rect.right * 100) / 100
      });
      if (outliers.length >= 12) break;
    }
    return { clientWidth: width, scrollWidth, overflow: scrollWidth > width, outliers };
  });
  report.layouts.push({ label, ...result });
  check(`${label}: no page overflow`, !result.overflow, result);
}

async function preparePage(context, url, viewport, label) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  page.on('pageerror', (error) => report.errors.push({ viewport: label, message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push({ viewport: label, message: message.text() });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push({ viewport: label, url: response.url(), status: response.status() });
  });
  page.on('requestfailed', (request) => report.failedRequests.push({ viewport: label, url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  check(`${label}: article HTTP 200`, response?.status() === 200, response?.status());
  await page.waitForFunction(() => Array.from({ length: 5 }, (_, i) => document.getElementById(`demo${i + 1}`)?.dataset.mounted === 'true').every(Boolean));
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    await document.fonts.ready;
  });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
  const assets = await page.evaluate(() => ({
    images: Array.from(document.images).map((img) => ({ src: img.getAttribute('src'), complete: img.complete, width: img.naturalWidth, height: img.naturalHeight })),
    fonts: Array.from(document.fonts).map((font) => ({ family: font.family, weight: font.weight, status: font.status }))
  }));
  report.assets.push({ viewport: label, ...assets });
  if (!preliminary) {
    check(`${label}: all referenced images decode`, assets.images.every((image) => image.complete && image.width > 0), assets.images);
    check(`${label}: two WenKai faces load`, assets.fonts.filter((font) => font.family.includes('LXGW WenKai') && font.status === 'loaded').length >= 2, assets.fonts);
  }
  return page;
}

async function runBehavior(page, label, full) {
  const button = (id, action, value) => page.locator(`#demo${id} button[data-action="${action}"]${value ? `[data-value="${value}"]` : ''}`);
  const click = (id, action, value) => button(id, action, value).click();
  const data = (id) => page.locator(`#demo${id}`).evaluate((node) => ({ ...node.dataset }));
  const text = (id, view) => page.locator(`#demo${id} [data-view="${view}"]`).textContent();
  const assert = (name, value, details) => check(`${label}: ${name}`, value, details);

  assert('VOL.24 identity', (await page.title()).includes('VOL.24'));
  assert('five demos', await page.locator('.demo[id^="demo"]').count() === 5);
  assert('five resets', await page.locator('.demo button[data-action="reset"]').count() === 5);
  assert('five live status regions', await page.locator('.demo [data-status][role="status"][aria-live="polite"]').count() === 5);
  assert('button types', await page.locator('.demo button').evaluateAll((nodes) => nodes.every((node) => node.getAttribute('type') === 'button')));

  if (full) {
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    assert('keyboard skip link', new URL(page.url()).hash === '#contents');
  }

  for (const route of full ? ['cli', 'http', 'mcp'] : ['mcp']) {
    await click(1, 'route', route);
    for (let i = 0; i < 6; i += 1) await click(1, 'next');
    const state = await data(1);
    assert(`${route} route completes`, state.state === 'completed' && state.step === '6');
    assert(`${route} route delivers`, await text(1, 'result') === '已验收，允许交付');
    assert(`${route} end disables next`, await button(1, 'next').isDisabled());
  }
  await screenshot(page, `${label}-demo1-completed`, '#demo1');
  await click(1, 'reset');
  assert('route reset to CLI start', (await data(1)).route === 'cli' && (await data(1)).step === '0');

  assert('skill body initially disabled', await button(2, 'load-body').isDisabled());
  assert('skill script initially disabled', await button(2, 'run-script').isDisabled());
  await click(2, 'discover');
  const charsMetadata = +(await data(2)).chars;
  await button(2, 'load-body').focus();
  await page.keyboard.press('Enter');
  const charsBody = +(await data(2)).chars;
  assert('keyboard loads skill body', (await data(2)).state === 'body-loaded');
  assert('progressive chars grow', charsBody > charsMetadata && charsMetadata > 0);
  assert('body does not execute script', (await data(2)).executed === 'false');
  await click(2, 'load-reference');
  const charsReference = +(await data(2)).chars;
  await click(2, 'load-reference');
  assert('same reference does not double count', +(await data(2)).chars === charsReference && charsReference > charsBody);
  await click(2, 'run-script');
  assert('script execution separately recorded', (await data(2)).executed === 'true' && +(await data(2)).chars === charsReference);
  await screenshot(page, `${label}-demo2-loaded`, '#demo2');
  await click(2, 'reset');
  assert('skill reset clears state', (await data(2)).chars === '0' && (await data(2)).executed === 'false');
  if (full) {
    await click(2, 'discover'); await click(2, 'load-body'); await click(2, 'run-script');
    assert('script can run without loading optional reference', await text(2, 'references') === '0 份');
    await click(2, 'reset');
  }

  assert('MCP call requires handshake', await button(3, 'call').isDisabled());
  await click(3, 'next');
  assert('initialize first', (await text(3, 'log')).includes('"method": "initialize"') && (await data(3)).phase === '1');
  await click(3, 'next');
  const notification = await text(3, 'log');
  assert('initialized notification has no ID', notification.includes('notifications/initialized') && !notification.includes('"id"'));
  await click(3, 'next');
  const toolsList = await text(3, 'log');
  assert('tools list before calls', (await data(3)).phase === '3' && toolsList.includes('inputSchema'));
  const countSchema = toolsList.match(/"count":\s*\{[^}]*\}/)?.[0] || '';
  assert('count schema does not invent default', countSchema.includes('"maximum": 4') && !countSchema.includes('"default"'));
  await click(3, 'case', 'schema-error'); await click(3, 'call');
  assert('schema errors are intercepted', (await data(3)).state === 'schema-error' && (await data(3)).calls === '0');
  assert('both schema faults explained', (await text(3, 'log')).includes('1–12000') && (await text(3, 'log')).includes('1–4'));
  await screenshot(page, `${label}-demo3-schema-error`, '#demo3');
  await click(3, 'case', 'valid'); await click(3, 'call');
  assert('valid request returns submission', (await data(3)).state === 'submitted' && (await data(3)).calls === '1');
  assert('valid wire uses tools/call and explicit count', (await text(3, 'log')).includes('"method": "tools/call"')
    && (await text(3, 'log')).includes('"wait": false') && (await text(3, 'log')).includes('"count": 1'));
  assert('submit is not completion', (await text(3, 'log')).includes('submitted') && (await text(3, 'log')).includes('queued'));
  if (full) {
    await screenshot(page, `${label}-demo3-submitted`, '#demo3');
    await click(3, 'case', 'rpc-error'); await click(3, 'call');
    assert('JSON-RPC error distinct', (await data(3)).state === 'rpc-error' && (await text(3, 'log')).includes('-32601'));
  }
  await click(3, 'case', 'tool-error'); await click(3, 'call');
  assert('tool failure uses result.isError', (await data(3)).state === 'tool-error' && (await text(3, 'log')).includes('"isError": true'));
  await screenshot(page, `${label}-demo3-tool-error`, '#demo3');
  await click(3, 'reset');
  assert('protocol reset restores handshake requirement', (await data(3)).phase === '0' && (await data(3)).calls === '0' && await button(3, 'call').isDisabled());

  assert('query disabled before submit', await button(4, 'query').isDisabled());
  await click(4, 'submit');
  assert('first submit is queued', (await data(4)).serverState === 'queued' && (await data(4)).submissions === '1');
  assert('second submit disabled', await button(4, 'submit').isDisabled());
  await click(4, 'advance');
  assert('server runs independently of client observation', (await data(4)).serverState === 'running' && (await data(4)).clientState === 'submitted');
  await click(4, 'timeout');
  assert('timeout preserves running task', (await data(4)).serverState === 'running' && (await data(4)).clientState === 'timed-out');
  if (full) await screenshot(page, `${label}-demo4-client-timeout`, '#demo4');
  await click(4, 'advance');
  assert('server completion can outlive client wait', (await data(4)).serverState === 'completed' && (await data(4)).clientState === 'timed-out');
  await click(4, 'query'); await click(4, 'query');
  const job = await data(4);
  assert('query same ID without another submit', job.observed === 'completed' && job.submissions === '1' && job.queries === '2');
  assert('real query parameter is id', (await text(4, 'log')).includes('"id": "gen-demo-001"'));
  assert('completed result carries files', (await text(4, 'log')).includes('"images"') && (await text(4, 'log')).includes('"mime": "image/png"'));
  await screenshot(page, `${label}-demo4-query-completed`, '#demo4');
  await click(4, 'reset');
  assert('task reset clears counters', (await data(4)).submissions === '0' && (await data(4)).queries === '0' && await text(4, 'job-id') === '—');
  if (full) {
    await click(4, 'submit'); await click(4, 'fail'); await click(4, 'query');
    assert('failed task queried explicitly', (await data(4)).observed === 'failed' && (await text(4, 'log')).includes('DEMO_UPSTREAM_FAILED'));
    assert('failed task cannot advance', await button(4, 'advance').isDisabled());
    await screenshot(page, `${label}-demo4-failed`, '#demo4');
    await click(4, 'reset'); await click(4, 'submit'); await click(4, 'cancel'); await click(4, 'query');
    assert('cancelled is a separate service state', (await data(4)).observed === 'cancelled' && (await data(4)).serverState === 'cancelled');
    await click(4, 'reset');
  }

  const faults = full ? ['skill-missing', 'tool-hidden', 'bad-arguments', 'service-failed', 'bad-file', 'wrong-size', 'ok']
    : ['bad-file', 'wrong-size', 'ok'];
  for (const fault of faults) {
    await click(5, 'case', fault);
    assert(`${fault} clears previous acceptance`, (await data(5)).accepted === 'false' && (await data(5)).state === 'ready');
    await click(5, 'inspect');
    await page.waitForFunction(() => ['blocked', 'rejected', 'accepted'].includes(document.getElementById('demo5').dataset.state));
    const expected = fault === 'ok' ? 'accepted' : ['bad-file', 'wrong-size'].includes(fault) ? 'rejected' : 'blocked';
    assert(`${fault} has correct inspection result`, (await data(5)).state === expected);
    if (fault === 'bad-file') {
      assert('PNG extension cannot hide HTML', await text(5, 'format') === 'HTML / 非 PNG' && (await text(5, 'log')).includes('3c 68 74 6d'));
      await screenshot(page, `${label}-demo5-fake-png`, '#demo5');
    } else if (fault === 'wrong-size') {
      assert('valid wrong-size PNG rejected', await text(5, 'dimensions') === '1024 × 1536' && await text(5, 'format') === 'PNG · 已解码');
      if (full) await screenshot(page, `${label}-demo5-wrong-size`, '#demo5');
    } else if (fault === 'ok') {
      assert('actual decode has correct dimensions', await text(5, 'dimensions') === '1536 × 1024' && await text(5, 'format') === 'PNG · 已解码');
      assert('successful file acceptance', (await data(5)).accepted === 'true' && await text(5, 'accepted') === '文件检查通过');
      await screenshot(page, `${label}-demo5-valid-png`, '#demo5');
    }
  }
  if (full) {
    await page.evaluate(() => {
      const root = document.getElementById('demo5');
      root.querySelector('[data-action="case"][data-value="ok"]').click();
      root.querySelector('[data-action="inspect"]').click();
      root.querySelector('[data-action="reset"]').click();
    });
    await page.waitForTimeout(80);
    assert('reset invalidates pending image decode', (await data(5)).state === 'ready' && (await data(5)).accepted === 'false');
  } else {
    await click(5, 'reset');
  }
  assert('file inspection reset', (await data(5)).state === 'ready' && await text(5, 'accepted') === '未验收');
  await auditLayout(page, `${label} dynamic results`);
}

async function narrowSmoke(page, label) {
  const click = (id, action, value) => page.locator(`#demo${id} button[data-action="${action}"]${value ? `[data-value="${value}"]` : ''}`).click();
  await click(1, 'route', 'mcp'); for (let i = 0; i < 6; i += 1) await click(1, 'next');
  await click(2, 'discover'); await click(2, 'load-body'); await click(2, 'load-reference');
  for (let i = 0; i < 3; i += 1) await click(3, 'next');
  await click(3, 'case', 'schema-error'); await click(3, 'call');
  await click(4, 'submit'); await click(4, 'advance'); await click(4, 'timeout'); await click(4, 'advance'); await click(4, 'query');
  await click(5, 'case', 'ok'); await click(5, 'inspect');
  await page.waitForFunction(() => document.getElementById('demo5').dataset.state === 'accepted');
  check(`${label}: all demos interactive`, await page.locator('#demo1').getAttribute('data-state') === 'completed'
    && await page.locator('#demo3').getAttribute('data-state') === 'schema-error'
    && await page.locator('#demo4').getAttribute('data-observed') === 'completed'
    && await page.locator('#demo5').getAttribute('data-state') === 'accepted');
  await screenshot(page, `${label}-demo4-query-completed`, '#demo4');
  await auditLayout(page, `${label} dynamic results`);
}

(async () => {
  let server;
  let browser;
  try {
    let url = process.env.ARTICLE_URL;
    if (url) {
      if (!/^https?:\/\//i.test(url)) throw new Error('ARTICLE_URL must be an HTTP(S) URL.');
    } else {
      const local = await serveLocal(); server = local.server; url = local.url;
    }
    report.target = url;
    const { chromium } = loadPlaywright();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const desktop = await preparePage(context, url, { width: 1440, height: 1000 }, '1440');
    await screenshot(desktop, '1440-hero');
    await screenshot(desktop, '1440-contents', '#contents');
    await auditLayout(desktop, '1440 initial');
    await runBehavior(desktop, '1440', true);
    await desktop.close();

    const mobile = await preparePage(context, url, { width: 390, height: 844 }, '390');
    await screenshot(mobile, '390-hero', '.hero');
    await screenshot(mobile, '390-contents', '#contents');
    await auditLayout(mobile, '390 initial');
    await runBehavior(mobile, '390', false);
    await mobile.close();

    const narrow = await preparePage(context, url, { width: 320, height: 800 }, '320');
    await screenshot(narrow, '320-hero', '.hero');
    await auditLayout(narrow, '320 initial');
    await narrowSmoke(narrow, '320');
    await narrow.close();

    check('no JavaScript page errors', report.errors.length === 0, report.errors);
    if (!preliminary) {
      check('no console errors', report.consoleErrors.length === 0, report.consoleErrors);
      check('no failed resource responses', report.failedResponses.length === 0, report.failedResponses);
      check('no failed resource requests', report.failedRequests.length === 0, report.failedRequests);
    }
  } catch (error) {
    report.errors.push({ scope: 'verifier', message: error.message, stack: error.stack });
    check('verifier completes', false, error.message);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    report.completedAt = new Date().toISOString();
    report.passed = report.checks.filter((entry) => entry.passed).length;
    report.failed = report.checks.filter((entry) => !entry.passed).length;
    report.complete = !preliminary && report.failed === 0;
    fs.writeFileSync(RESULTS, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      phase: report.phase, complete: report.complete, passed: report.passed, failed: report.failed,
      errors: report.errors, failedChecks: report.checks.filter((entry) => !entry.passed),
      overflow: report.layouts.filter((layout) => layout.overflow),
      pendingResources: preliminary ? report.failedResponses : [],
      screenshots: report.screenshots.length, results: RESULTS
    }, null, 2));
    if (report.failed > 0) process.exitCode = 1;
  }
})();
