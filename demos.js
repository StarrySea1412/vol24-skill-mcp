'use strict';

/*
 * 五枚浏览器内小样。所有任务、报文和故障都是固定夹具；不调用生图服务。
 * 第 05 枚实际读取本地生成 PNG 的签名、IHDR 与解码尺寸。
 * 业务工具契约：ai-image-studio/src/mcp-server.js，核对于 2026-11-24。
 */
(() => {
  const JSON_TEXT = (value) => JSON.stringify(value, null, 2);
  const DEMO_ID = 'gen-demo-001';
  const PROMPT = '文章插图：纸色背景、蓝色墨线，流程卡与工具接口相连；横向构图，无文字。';

  function write(root, name, value) {
    root.querySelectorAll(`[data-view="${name}"]`).forEach((node) => {
      node.textContent = String(value);
    });
  }

  function announce(root, value) {
    root.querySelectorAll('[data-status]').forEach((node) => {
      node.textContent = value;
    });
  }

  function disable(root, action, value) {
    root.querySelectorAll(`button[data-action="${action}"]`).forEach((node) => {
      node.disabled = Boolean(value);
    });
  }

  function select(root, action, value) {
    root.querySelectorAll(`button[data-action="${action}"]`).forEach((node) => {
      const selected = node.dataset.value === value;
      node.setAttribute('aria-pressed', String(selected));
      node.dataset.selected = String(selected);
    });
  }

  function mount(id, initial, dispatch, render) {
    const root = document.getElementById(id);
    if (!root || root.dataset.mounted === 'true') return;
    root.dataset.mounted = 'true';
    let state = initial();
    const refresh = () => render(root, state);
    root.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('button[data-action]')
        : null;
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.action === 'reset') {
        if (typeof state.revision === 'number') state.revision += 1;
        state = initial();
        refresh();
        return;
      }
      dispatch(state, button.dataset.action, button.dataset.value, refresh);
      refresh();
    });
    refresh();
  }

  const ROUTES = {
    cli: {
      label: '普通提示 + CLI',
      steps: [
        ['用户 + 模型', '明确交付要求', '请求里写清用途、横向构图和验收条件。'],
        ['宿主', '确认命令能执行', '检查本机 CLI、运行环境和本次操作权限。'],
        ['模型', '组成 CLI 参数', '把自然语言要求整理为该 CLI 接受的参数。'],
        ['CLI + 生图服务', '执行并保存结果', '由已配置的 CLI 处理请求；这里不执行外部命令。'],
        ['模型 + 本地检查工具', '检查实际文件', '打开文件，检查格式、尺寸和画面是否满足请求。'],
        ['模型', '交付已验收的图', '这条路线可以完成；操作步骤由当前提示与 CLI 约定提供。']
      ]
    },
    http: {
      label: 'Skill + HTTP 脚本',
      steps: [
        ['宿主 + 模型', '发现并加载技能', '按技能描述找到文章配图流程，再读 SKILL.md。'],
        ['模型（Skill 提供规程）', '取出流程与材料', '确定用途、比例、风格及交付检查，按需读取参考材料。'],
        ['宿主', '检查脚本运行条件', '技能可以带 HTTP 脚本；依赖与权限仍由宿主检查。'],
        ['HTTP 脚本 + 生图服务', '提交并查询同一任务', '脚本按服务自己的 HTTP 合同提交，再用返回编号查询。'],
        ['检查脚本 + 模型', '验收实际文件', '文件检查与画面判断共同决定是否允许交付。'],
        ['模型', '交付已验收的图', '这条路线也可以完成；复用的做法存放在 Skill 中。']
      ]
    },
    mcp: {
      label: 'Skill + MCP',
      steps: [
        ['宿主 + 模型', '发现并加载技能', '读取文章配图流程，确定本次需要哪些工具与材料。'],
        ['MCP 客户端 + 服务端', '握手并列出工具', 'initialize → notifications/initialized → tools/list。'],
        ['模型 + 宿主', '组装并核对参数', '按照 generate_image 的 inputSchema 填写 prompt、count、wait。'],
        ['MCP 服务端 + 生图服务', '提交并查询同一任务', 'tools/call 调 generate_image；get_generation({id}) 查询原编号。'],
        ['本地检查工具 + 模型', '验收实际文件', '工具返回路径之后，再检查格式、尺寸与画面。'],
        ['模型', '交付已验收的图', '这条路线可以完成；Skill 复用做法，MCP 统一工具接入。']
      ]
    }
  };

  function initRoutes() {
    return { route: 'cli', step: 0, message: '选择一条路线，再逐步走完同一个配图任务。' };
  }

  function routeAction(state, action, value) {
    if (action === 'route' && ROUTES[value]) {
      state.route = value;
      state.step = 0;
      state.message = '已切换路线；交付目标相同，从第一步开始。';
    } else if (action === 'next' && state.step < ROUTES[state.route].steps.length) {
      state.step += 1;
      state.message = state.step === ROUTES[state.route].steps.length
        ? '已完成六步。三条路线都能交付，维护的接口与流程位置不同。'
        : '当前步骤已展开；按下一步继续。';
    }
  }

  function renderRoutes(root, state) {
    const route = ROUTES[state.route];
    const current = state.step ? route.steps[state.step - 1] : null;
    const completed = state.step === route.steps.length;
    root.dataset.state = completed ? 'completed' : state.step ? 'running' : 'ready';
    root.dataset.route = state.route;
    root.dataset.step = String(state.step);
    write(root, 'route', route.label);
    write(root, 'step', `${state.step} / ${route.steps.length}`);
    write(root, 'owner', current ? current[0] : '等待开始');
    write(root, 'result', completed ? '已验收，允许交付' : '尚未交付');
    write(root, 'log', state.step
      ? route.steps.slice(0, state.step).map((step, index) =>
        `${String(index + 1).padStart(2, '0')} · ${step[1]}\n负责：${step[0]}\n${step[2]}`
      ).join('\n\n')
      : `${route.label}\n目标：为文章生成一张横向插图，检查后交付。\n固定路径推演；不会运行命令、脚本或 MCP 请求。`);
    announce(root, state.message);
    select(root, 'route', state.route);
    disable(root, 'next', completed);
  }

  const SKILL_METADATA = [
    'name: article-illustration',
    'description: 当文章需要配图、封面或统一风格的章节插画时使用。按用途选择比例，生成后检查并交付。'
  ].join('\n');
  const SKILL_BODY = [
    '# 文章配图流程（演示用片段）',
    '1. 读取插图对应的段落，确定这张图需要解释什么。',
    '2. 按用途选择比例；本例交付尺寸为 1536 × 1024。',
    '3. 需要保持系列风格时，读取 references/visual-style.md。',
    '4. 使用当前可用的生图工具，记录服务返回的任务编号。',
    '5. 查询同一任务；客户端等待超时不能替代服务状态。',
    '6. 需要文件检查时，执行 scripts/check_image.py，再目检画面。'
  ].join('\n');
  const SKILL_REFERENCE = [
    '# 系列风格（演示用参考）',
    '米色纸张、蓝色墨线、少量赭色强调。',
    '图解释结构与动作；正文标题和图号在 HTML 中排版。',
    '参考文件按需加载，不在发现技能时自动全文塞入。'
  ].join('\n');
  const characters = (value) => Array.from(value).length;

  function initSkill() {
    return { discovered: false, body: false, reference: false, executed: false,
      log: '技能尚未进入本小样的发现清单。', message: '先发现技能，再决定是否加载正文。' };
  }

  function skillAction(state, action) {
    if (action === 'discover') {
      state.discovered = true;
      state.log = `发现阶段 · name / description\n\n${SKILL_METADATA}`;
      state.message = '只加入元数据。模型还没读到流程正文。';
    } else if (action === 'load-body' && state.discovered) {
      state.body = true;
      state.log = `加载 SKILL.md 正文\n\n${SKILL_BODY}`;
      state.message = '已读流程；参考文件和脚本还没有因为这一动作自动运行。';
    } else if (action === 'load-reference' && state.body) {
      state.reference = true;
      state.log = `按需读取 references/visual-style.md\n\n${SKILL_REFERENCE}`;
      state.message = '参考内容加入计数。再次读取不会重复累加。';
    } else if (action === 'run-script' && state.body) {
      state.executed = true;
      state.log = [
        '模拟执行 scripts/check_image.py',
        'stdout: format=PNG width=1536 height=1024 decode=ok',
        'exit_code=0',
        '',
        '这里仅演示「读取指令」和「执行脚本」是两个动作。',
        '计数只覆盖本小样加载的技能文档；不代表模型的总上下文或 token 数。',
        '执行脚本无需在本计数中自动加入脚本源码。'
      ].join('\n');
      state.message = '脚本执行已单独记录。第 05 枚小样会实际检查本地 PNG 夹具。';
    }
  }

  function renderSkill(root, state) {
    const total = (state.discovered ? characters(SKILL_METADATA) : 0)
      + (state.body ? characters(SKILL_BODY) : 0)
      + (state.reference ? characters(SKILL_REFERENCE) : 0);
    root.dataset.state = state.executed ? 'executed' : state.reference ? 'reference-loaded'
      : state.body ? 'body-loaded' : state.discovered ? 'discovered' : 'undiscovered';
    root.dataset.chars = String(total);
    root.dataset.executed = String(state.executed);
    write(root, 'layer', state.reference ? '元数据 + 正文 + 参考' : state.body ? '元数据 + 正文'
      : state.discovered ? '仅元数据' : '尚未发现');
    write(root, 'chars', `${total} 字符`);
    write(root, 'references', `${state.reference ? 1 : 0} 份`);
    write(root, 'executed', state.executed ? '已执行（模拟）' : '未执行');
    write(root, 'log', state.log);
    announce(root, state.message);
    disable(root, 'load-body', !state.discovered);
    disable(root, 'load-reference', !state.body);
    disable(root, 'run-script', !state.body);
  }

  const IMAGE_SCHEMA = {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: 12000 },
      count: { type: 'integer', minimum: 1, maximum: 4 },
      wait: { type: 'boolean', default: true }
    },
    required: ['prompt']
  };
  const CASE_LABELS = {
    valid: '合法参数',
    'schema-error': '空 prompt + count=5',
    'rpc-error': '错误的协议方法',
    'tool-error': '工具执行失败'
  };
  const PHASES = ['尚未握手', 'initialize 已响应', 'initialized 已通知', '工具清单已取得'];

  function validateImageArguments(args) {
    const errors = [];
    if (typeof args.prompt !== 'string') errors.push('prompt 必须是字符串。');
    else if (characters(args.prompt) < 1 || characters(args.prompt) > 12000)
      errors.push('prompt 长度必须为 1–12000 字符。');
    if (args.count !== undefined && (!Number.isInteger(args.count) || args.count < 1 || args.count > 4))
      errors.push('count 必须是 1–4 的整数。');
    if (args.wait !== undefined && typeof args.wait !== 'boolean') errors.push('wait 必须是布尔值。');
    return errors;
  }

  function initProtocol() {
    return { phase: 0, selected: 'valid', calls: 0, errorKind: '尚未调用', result: 'ready',
      log: '固定 MCP 报文示例 · protocolVersion=2025-06-18\n先握手，再取得工具清单。',
      message: '按下一步重放握手。本例采用公开协议版本 2025-06-18。' };
  }

  function protocolAction(state, action, value) {
    if (action === 'case' && CASE_LABELS[value]) {
      state.selected = value;
      state.result = 'ready';
      state.errorKind = '尚未调用';
      state.log = `已选择：${CASE_LABELS[value]}\n${state.phase === 3 ? '可以发起调用。' : '请先走完握手并取得工具清单。'}`;
      state.message = '场景已切换；选择场景不增加调用次数。';
      return;
    }
    if (action === 'next' && state.phase < 3) {
      state.phase += 1;
      state.result = 'ready';
      if (state.phase === 1) {
        state.log = [
          '客户端 → 服务端', JSON_TEXT({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
            protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'article-demo', version: '1.0' }
          } }), '', '服务端 → 客户端', JSON_TEXT({ jsonrpc: '2.0', id: 1, result: {
            protocolVersion: '2025-06-18', capabilities: { tools: {} },
            serverInfo: { name: 'image-service-demo', version: '1.0' }
          } })
        ].join('\n');
        state.message = 'initialize 协商版本与能力；还需要发送 initialized 通知。';
      } else if (state.phase === 2) {
        state.log = `客户端 → 服务端\n${JSON_TEXT({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n\n通知没有 id，也没有对应的 JSON-RPC 响应。`;
        state.message = '初始化通知已发送。下一步请求工具清单。';
      } else {
        state.log = [
          '客户端 → 服务端', JSON_TEXT({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
          '', '服务端 → 客户端 · 只节选本小样使用的三个参数',
          JSON_TEXT({ jsonrpc: '2.0', id: 2, result: { tools: [{
            name: 'generate_image', description: '生成图像（演示中不执行）', inputSchema: IMAGE_SCHEMA
          }] } })
        ].join('\n');
        state.message = '工具清单提供名称、说明与 inputSchema；它没有替模型填写业务参数。';
      }
      return;
    }
    if (action !== 'call' || state.phase !== 3) return;
    const args = state.selected === 'schema-error'
      ? { prompt: '', count: 5, wait: false }
      : { prompt: PROMPT, count: 1, wait: false };
    const validation = validateImageArguments(args);
    if (validation.length) {
      state.result = 'schema-error';
      state.errorKind = '宿主参数校验';
      state.log = [
        '待发送 arguments', JSON_TEXT(args), '', '本小样在宿主侧拦截：',
        ...validation.map((error, index) => `${index + 1}. ${error}`),
        '', '未发送 tools/call；调用请求计数不增加。',
        '这是本小样的校验策略，不保证每个 MCP 宿主都在同一位置拦截。'
      ].join('\n');
      state.message = '参数检查失败。修参数，不能靠重启服务补齐空 prompt。';
      return;
    }
    state.calls += 1;
    const requestId = 2 + state.calls;
    if (state.selected === 'rpc-error') {
      state.result = 'rpc-error';
      state.errorKind = 'JSON-RPC error';
      state.log = [
        '客户端 → 服务端 · 故意使用不存在的方法',
        JSON_TEXT({ jsonrpc: '2.0', id: requestId, method: 'tools/generate', params: args }),
        '', '服务端 → 客户端 · 固定协议错误夹具',
        JSON_TEXT({ jsonrpc: '2.0', id: requestId, error: { code: -32601, message: 'Method not found' } }),
        '', '没有 result。修复调用方法，应使用 tools/call。'
      ].join('\n');
      state.message = 'JSON-RPC 方法无法识别。业务生成还没有被正确调用。';
    } else if (state.selected === 'tool-error') {
      state.result = 'tool-error';
      state.errorKind = '工具 isError';
      state.log = [
        '客户端 → 服务端', JSON_TEXT({ jsonrpc: '2.0', id: requestId, method: 'tools/call',
          params: { name: 'generate_image', arguments: args } }),
        '', '服务端 → 客户端 · 固定工具失败夹具',
        JSON_TEXT({ jsonrpc: '2.0', id: requestId, result: {
          content: [{ type: 'text', text: '上游生图服务暂时不可用（模拟）。' }], isError: true
        } }),
        '', 'JSON-RPC 请求得到 result；result.isError 标记工具执行失败。'
      ].join('\n');
      state.message = '方法和参数可以被处理，工具执行失败。下一步检查服务错误。';
    } else {
      state.result = 'submitted';
      state.errorKind = '无';
      const id = `gen-demo-${String(state.calls).padStart(3, '0')}`;
      state.log = [
        '客户端 → 服务端', JSON_TEXT({ jsonrpc: '2.0', id: requestId, method: 'tools/call',
          params: { name: 'generate_image', arguments: args } }),
        '', '服务端 → 客户端 · 业务提交结果是 text 中的 JSON',
        JSON_TEXT({ jsonrpc: '2.0', id: requestId, result: { content: [{ type: 'text', text: JSON_TEXT({
          submitted: [id], generations: [{ id, status: 'queued', count: 1 }], hint: '用 get_generation 查询进度'
        }) }] } }),
        '', 'submitted / generations / queued 是画境的业务字段；不是 MCP 通用任务状态。'
      ].join('\n');
      state.message = '已取得任务编号。wait:false 表示返回提交结果，还没有交付图片。';
    }
  }

  function renderProtocol(root, state) {
    root.dataset.state = state.result;
    root.dataset.phase = String(state.phase);
    root.dataset.calls = String(state.calls);
    write(root, 'phase', PHASES[state.phase]);
    write(root, 'error-kind', state.errorKind);
    write(root, 'calls', `${state.calls} 次`);
    write(root, 'log', state.log);
    announce(root, state.message);
    select(root, 'case', state.selected);
    disable(root, 'next', state.phase === 3);
    disable(root, 'call', state.phase !== 3);
  }

  const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

  function initJob() {
    return { id: null, server: 'not-submitted', client: 'idle', observed: null,
      submissions: 0, queries: 0, history: ['尚未提交。服务端没有本小样的任务。'],
      message: '先提交一次，再推进服务端或查询同一个编号。' };
  }

  function generationResult(state) {
    return { generation: {
      id: state.id, status: state.server, title: '文章配图 · 固定任务夹具', prompt: PROMPT,
      model: 'demo-image-model', providerName: '本地演示夹具', size: '1536x1024', count: 1,
      createdAt: '2026-11-24T00:00:00.000Z',
      ...(state.server === 'failed' ? { error: { code: 'DEMO_UPSTREAM_FAILED', message: '模拟的上游执行失败。' } } : {}),
      images: state.server === 'completed'
        ? [{ file: '/demo/output/article.png', url: '/demo/preview/article.png', mime: 'image/png' }]
        : []
    } };
  }

  function jobAction(state, action) {
    if (action === 'submit' && state.submissions === 0) {
      state.id = DEMO_ID;
      state.server = 'queued';
      state.client = 'submitted';
      state.submissions = 1;
      state.history = [
        `tools/call generate_image(${JSON_TEXT({ prompt: PROMPT, count: 1, wait: false })})`,
        JSON_TEXT({ submitted: [state.id], generations: [{ id: state.id, status: 'queued', count: 1 }], hint: '用 get_generation 查询进度' })
      ];
      state.message = '只提交了一次，取得固定编号。服务端现在排队，客户端知道已受理。';
      return;
    }
    if (!state.id) return;
    if (action === 'advance' && !TERMINAL.has(state.server)) {
      const before = state.server;
      state.server = before === 'queued' ? 'running' : 'completed';
      state.history.push(`服务端手动前进：${before} → ${state.server}\n客户端不会因为这一操作自动收到新的查询结果。`);
      state.message = '服务端已前进；再查询，客户端才能观察到这一步。';
    } else if (action === 'query') {
      state.queries += 1;
      state.client = 'observed';
      state.observed = state.server;
      state.history.push(`tools/call get_generation(${JSON_TEXT({ id: state.id })})\n${JSON_TEXT(generationResult(state))}`);
      state.message = state.server === 'completed'
        ? '原编号已查到 completed 和文件位置。还需要验收文件，才允许交付。'
        : state.server === 'failed'
          ? '原编号已查到 failed。服务端明确失败，检查 error；查询没有创建新任务。'
          : `原编号查到 ${state.server}。查询次数增加，提交次数仍是 1。`;
    } else if (action === 'timeout' && state.client !== 'timed-out' && !TERMINAL.has(state.observed)) {
      state.client = 'timed-out';
      state.history.push(`客户端等待超时。\n服务端仍是 ${state.server}；此动作没有发出取消，也没有重新提交。`);
      state.message = '等待超时改变的是客户端观察。用原编号查询，确认服务端事实。';
    } else if (action === 'fail' && !TERMINAL.has(state.server)) {
      state.server = 'failed';
      state.history.push('服务端注入固定失败：DEMO_UPSTREAM_FAILED。\n客户端需要查询才能得到失败结果。');
      state.message = '服务端已明确失败。按查询查看原任务的错误。';
    } else if (action === 'cancel' && !TERMINAL.has(state.server)) {
      state.server = 'cancelled';
      state.history.push('服务端注入固定 cancelled 状态。\n这是一条业务状态变化，不是等待超时的自动结果。');
      state.message = '服务端已取消。客户端超时与服务端取消是两种状态。';
    }
  }

  function renderJob(root, state) {
    root.dataset.state = state.server;
    root.dataset.serverState = state.server;
    root.dataset.clientState = state.client;
    root.dataset.observed = state.observed || 'none';
    root.dataset.submissions = String(state.submissions);
    root.dataset.queries = String(state.queries);
    write(root, 'job-id', state.id || '—');
    write(root, 'server-state', state.server === 'not-submitted' ? '尚未提交' : state.server);
    write(root, 'client-state', state.client === 'idle' ? '等待开始' : state.client === 'submitted'
      ? '已收到任务编号' : state.client === 'timed-out' ? '等待超时' : `已查到 ${state.observed}`);
    write(root, 'submissions', `${state.submissions} 次`);
    write(root, 'queries', `${state.queries} 次`);
    write(root, 'log', state.history.join('\n\n'));
    announce(root, state.message);
    disable(root, 'submit', state.submissions > 0);
    disable(root, 'advance', !state.id || TERMINAL.has(state.server));
    disable(root, 'query', !state.id);
    disable(root, 'timeout', !state.id || state.client === 'timed-out' || TERMINAL.has(state.observed));
    disable(root, 'fail', !state.id || TERMINAL.has(state.server));
    disable(root, 'cancel', !state.id || TERMINAL.has(state.server));
  }

  const FAULTS = {
    'skill-missing': ['技能发现 / 加载', '配图流程没有被加载。查技能清单、description 与当前任务是否相符。'],
    'tool-hidden': ['宿主工具暴露', '当前工具清单没有 generate_image。查连接、服务能力与宿主暴露范围。'],
    'bad-arguments': ['参数组装 / 校验', 'prompt 为空或 count 越界。对照工具 inputSchema 修参数。'],
    'service-failed': ['生图服务 / 上游', '工具返回 isError；没有可交付的成功文件。查工具错误与服务记录。'],
    'bad-file': ['交付验收', '文件名叫 demo-output.png，实际字节是一段 HTML。'],
    'wrong-size': ['交付验收', '有效 PNG，但图像尺寸不符合本文 1536 × 1024 的固定交付合同。'],
    ok: ['交付验收', '本地生成的有效 PNG，尺寸与本文合同相符。画面用途仍需人工判断。']
  };
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  const pngFixtures = new Map();

  function pngFixture(width, height) {
    const key = `${width}x${height}`;
    if (pngFixtures.has(key)) return pngFixtures.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器没有可用的 Canvas 2D。');
    context.fillStyle = '#f4f0e6';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#45687b';
    context.fillRect(Math.floor(width / 4), Math.floor(height / 4), Math.floor(width / 2), Math.floor(height / 2));
    const dataUrl = canvas.toDataURL('image/png');
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value = { dataUrl, bytes };
    pngFixtures.set(key, value);
    return value;
  }

  function inspectPng(bytes) {
    if (bytes.length < 33 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
    if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20), format: 'PNG' };
  }

  function decodeLocal(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('浏览器无法解码这个 PNG。'));
      img.src = dataUrl;
    });
  }

  function initFault() {
    return { selected: 'skill-missing', inspected: false, busy: false, revision: 0,
      result: 'ready', location: '尚未检查', format: '—', dimensions: '—', accepted: '未验收',
      log: '选择一项固定故障，再执行检查。\n目标合同：PNG，1536 × 1024，可解码。',
      message: '这枚小样检查本地夹具；不会提交真实生图任务。' };
  }

  async function inspectFault(state, refresh) {
    const fault = FAULTS[state.selected];
    const selected = state.selected;
    const revision = state.revision;
    state.inspected = true;
    state.location = fault[0];
    state.accepted = '拒绝交付';
    if (!['bad-file', 'wrong-size', 'ok'].includes(selected)) {
      state.result = 'blocked';
      state.format = '尚无结果文件';
      state.dimensions = '—';
      state.log = `${fault[0]}\n${fault[1]}\n\n尚未取得文件，文件验收不能代替这层检查。`;
      state.message = `定位：${fault[0]}。先修这一层，再继续任务。`;
      return;
    }
    state.busy = true;
    state.result = 'inspecting';
    state.log = '正在读取本地夹具的文件签名与尺寸，并验证浏览器解码。';
    state.message = '正在检查本地文件夹具。';
    refresh();
    try {
      const fixture = selected === 'bad-file'
        ? { bytes: new TextEncoder().encode('<html><body>upstream error</body></html>'), dataUrl: null }
        : selected === 'wrong-size' ? pngFixture(1024, 1536) : pngFixture(1536, 1024);
      const signature = Array.from(fixture.bytes.slice(0, 8)).map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
      const header = inspectPng(fixture.bytes);
      if (!header) {
        state.format = 'HTML / 非 PNG';
        state.dimensions = '无法读取图像尺寸';
        state.result = 'rejected';
        state.log = `文件名：demo-output.png\n前 8 字节：${signature}\nPNG 签名：89 50 4e 47 0d 0a 1a 0a\n\n实际签名不符。文件后缀不能证明图像格式。`;
        state.message = '拒绝交付：文件名是 .png，实际内容无法作为 PNG 解码。';
      } else {
        const decoded = await decodeLocal(fixture.dataUrl);
        if (state.revision !== revision || state.selected !== selected) return;
        const matches = header.width === 1536 && header.height === 1024
          && decoded.width === header.width && decoded.height === header.height;
        state.format = 'PNG · 已解码';
        state.dimensions = `${decoded.width} × ${decoded.height}`;
        state.result = matches ? 'accepted' : 'rejected';
        state.accepted = matches ? '文件检查通过' : '拒绝交付';
        state.log = [
          '文件名：demo-output.png', `前 8 字节：${signature}`,
          `IHDR：${header.width} × ${header.height}`, `浏览器解码：${decoded.width} × ${decoded.height}`,
          '本文合同：PNG，1536 × 1024，可解码。', '',
          matches ? '格式、尺寸与解码检查通过。画面是否解释了正文，仍需要目检。'
            : '文件可以解码，尺寸与本文合同不符；不能以「有图片」代替验收。',
          '', '夹具由浏览器 Canvas 本地生成；不是模型输出，也不代表所有模型都支持这个尺寸。'
        ].join('\n');
        state.message = matches ? '文件检查通过。交付前还要确认画面满足正文用途。'
          : '拒绝交付：PNG 有效，但尺寸不符合本文固定合同。';
      }
    } catch (error) {
      if (state.revision !== revision || state.selected !== selected) return;
      state.result = 'rejected';
      state.accepted = '拒绝交付';
      state.format = '解码检查失败';
      state.dimensions = '—';
      state.log = `本地解码检查未通过：${error.message}`;
      state.message = '文件检查失败；没有将文件判为成功。';
    } finally {
      if (state.revision === revision && state.selected === selected) {
        state.busy = false;
        refresh();
      }
    }
  }

  function faultAction(state, action, value, refresh) {
    if (action === 'case' && FAULTS[value]) {
      state.revision += 1;
      state.selected = value;
      state.inspected = false;
      state.busy = false;
      state.result = 'ready';
      state.location = '尚未检查';
      state.format = '—';
      state.dimensions = '—';
      state.accepted = '未验收';
      state.log = `${FAULTS[value][0]}\n${FAULTS[value][1]}\n\n点击检查，查看这项固定故障的证据。`;
      state.message = '场景已切换；尚未执行检查。';
    } else if (action === 'inspect' && !state.busy) {
      void inspectFault(state, refresh);
    }
  }

  function renderFault(root, state) {
    root.dataset.state = state.result;
    root.dataset.case = state.selected;
    root.dataset.accepted = String(state.result === 'accepted');
    write(root, 'location', state.location);
    write(root, 'format', state.format);
    write(root, 'dimensions', state.dimensions);
    write(root, 'accepted', state.accepted);
    write(root, 'log', state.log);
    announce(root, state.message);
    select(root, 'case', state.selected);
    disable(root, 'inspect', state.busy);
  }

  function start() {
    mount('demo1', initRoutes, routeAction, renderRoutes);
    mount('demo2', initSkill, skillAction, renderSkill);
    mount('demo3', initProtocol, protocolAction, renderProtocol);
    mount('demo4', initJob, jobAction, renderJob);
    mount('demo5', initFault, faultAction, renderFault);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
