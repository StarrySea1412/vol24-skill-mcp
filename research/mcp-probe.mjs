import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const researchDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = 'D:/project/ai-image-studio/src/mcp-server.js';
const requestedProtocolVersion = '2025-06-18';
const serviceUrl = 'http://127.0.0.1:4173';
const child = spawn(process.execPath, [serverPath], {
  cwd: path.dirname(path.dirname(serverPath)),
  env: { ...process.env, AIS_INSTANCE_URL: serviceUrl },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
let nextId = 0;
let stdoutRemainder = '';
const pending = new Map();
let protocolIssue = null;

function failPending(error) {
  for (const item of pending.values()) {
    clearTimeout(item.timeout);
    item.reject(error);
  }
  pending.clear();
}
child.on('error', (error) => failPending(error));
child.on('exit', (code) => {
  if (pending.size) failPending(new Error('MCP server exited before responding: ' + code));
});
child.stderr.on('data', () => {}); // Drain diagnostics without persisting arbitrary service output.
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  stdoutRemainder += chunk;
  for (;;) {
    const newlineIndex = stdoutRemainder.indexOf('\n');
    if (newlineIndex < 0) break;
    const line = stdoutRemainder.slice(0, newlineIndex).trim();
    stdoutRemainder = stdoutRemainder.slice(newlineIndex + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); }
    catch {
      protocolIssue = new Error('Non-JSON data appeared on MCP stdout');
      failPending(protocolIssue);
      continue;
    }
    if (!Object.hasOwn(message, 'id') || !pending.has(message.id)) continue;
    const item = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(item.timeout);
    if (message.error) item.reject(new Error('JSON-RPC error ' + message.error.code + ': ' + message.error.message));
    else item.resolve(message.result);
  }
});
function request(method, params = undefined) {
  const id = ++nextId;
  const message = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Timed out waiting for ' + method));
    }, 10000);
    pending.set(id, { resolve, reject, timeout });
    child.stdin.write(JSON.stringify(message) + '\n');
  });
}
function notify(method) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
}
async function closeChild() {
  child.stdin.end();
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const stopTimer = setTimeout(() => child.kill(), 1200);
    const finalTimer = setTimeout(resolve, 2500);
    child.once('exit', () => {
      clearTimeout(stopTimer);
      clearTimeout(finalTimer);
      resolve();
    });
  });
}
try {
  const initialization = await request('initialize', {
    protocolVersion: requestedProtocolVersion,
    capabilities: {},
    clientInfo: { name: 'makers-notebook-readonly-probe', version: '1.0.0' },
  });
  notify('notifications/initialized');
  const listing = await request('tools/list');
  if (protocolIssue) throw protocolIssue;
  const observedTools = (listing.tools || []).filter((tool) => ['generate_image', 'get_generation'].includes(tool.name));
  if (observedTools.length !== 2) throw new Error('Expected generate_image and get_generation in the tool list');
  const observation = {
    observedAtUtc: new Date().toISOString(),
    requestedProtocolVersion,
    initialization,
    toolCount: (listing.tools || []).length,
    tools: observedTools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
    operations: ['initialize', 'notifications/initialized', 'tools/list'],
    toolCalls: 0,
    generationCalls: 0,
    serverPath,
    serviceUrl,
    note: 'Live read-only stdio observation. No tools/call, provider lookup, generation or service-data writes were requested.',
  };
  await writeFile(path.join(researchDir, 'mcp-observation.json'), JSON.stringify(observation, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({
    requestedProtocolVersion,
    negotiatedProtocolVersion: initialization.protocolVersion,
    serverInfo: initialization.serverInfo,
    toolCount: observation.toolCount,
    inputSchemas: Object.fromEntries(observedTools.map((tool) => [tool.name, tool.inputSchema])),
    toolCalls: 0,
  }, null, 2) + '\n');
} finally {
  await closeChild();
}
