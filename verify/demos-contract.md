# 五枚互动的 DOM 与验收契约

文件：`demos.js`。零依赖；用 `defer` 引用。脚本只更新存在的节点，报文与文本使用 `textContent`。不用远程脚本、随机数、真实 MCP 请求或生图任务。

所有容器使用 `id="demo1"` … `id="demo5"`。每个容器共享以下节点：

```html
<p data-status role="status" aria-live="polite"></p>
<pre data-view="log" tabindex="0"></pre>
<button type="button" data-action="reset">重来</button>
```

读数使用 `<span data-view="名称"></span>`。选项按钮采用 `aria-pressed`；脚本更新它。表单动作全部用语义 `<button type="button">`，支持键盘 Enter / Space。每个 demo 都独立重置。

## 01 · 同一任务三条路

按钮：

```html
<button type="button" data-action="route" data-value="cli">普通提示 + CLI</button>
<button type="button" data-action="route" data-value="http">Skill + HTTP 脚本</button>
<button type="button" data-action="route" data-value="mcp">Skill + MCP</button>
<button type="button" data-action="next">下一步</button>
```

读数：`route`、`step`、`owner`、`result`。

初值：路线 `cli`，`step` 为 `0 / 6`，`owner` 为 `等待开始`，`result` 为 `尚未交付`。容器 dataset：`state=ready`、`route=cli`、`step=0`。

验收路径：三条路线分别选择后，点击 `next` 六次。每条路线都应为 `state=completed`、`step=6`、`result=已验收，允许交付`，并禁用 `next`。切换路线回到第 0 步。重来回到 cli 第 0 步。

模型边界：路径是固定的责任拆解，所有路线都能完成。没有把 MCP 设为 Skill 的前置条件；不运行文中 CLI / HTTP 脚本。

## 02 · 渐进加载台

按钮 action：`discover`、`load-body`、`load-reference`、`run-script`、`reset`。

读数：`layer`、`chars`、`references`、`executed`。

初值：`state=undiscovered`、`chars=0`、`executed=false`；正文、参考和执行按钮禁用。

验收路径：

1. `discover`：`state=discovered`，`layer=仅元数据`；字符数从 0 增加，脚本未执行。
2. `load-body`：`state=body-loaded`；字符数继续增加，参考为 0 份，脚本仍未执行。
3. `load-reference`：`state=reference-loaded`；参考为 1 份，字符数增加。再次读取不会重复累加。
4. `run-script`：`state=executed`、`executed=true`；字符数保持原值，执行结果为模拟。
5. `reset`：回到 0 字符与未执行状态，禁用下游按钮。

可另测只加载正文后直接执行脚本：参考应仍为 0 份。计数是 `Array.from(text).length` 的实际文档字符数，含换行；不是 token 估算，也不是模型总上下文大小。样例文档和脚本输出是演示材料，不读取本机文件。

## 03 · 报文与参数台

按钮：

```html
<button type="button" data-action="next">下一步</button>
<button type="button" data-action="case" data-value="valid">合法参数</button>
<button type="button" data-action="case" data-value="schema-error">空 prompt + count=5</button>
<button type="button" data-action="case" data-value="rpc-error">错误的协议方法</button>
<button type="button" data-action="case" data-value="tool-error">工具执行失败</button>
<button type="button" data-action="call">发起调用</button>
```

读数：`phase`、`error-kind`、`calls`。

握手精确顺序：初始 `phase=0` → `initialize` 请求与响应（phase 1）→ `notifications/initialized`（phase 2，没有 id / 响应）→ `tools/list`（phase 3）。phase 3 才启用 `call`，禁用 `next`。

验收路径：

- 初始禁用 call。点击 next 三次，`dataset.phase=3`，日志应含 `tools/list`、`inputSchema` 与 `generate_image`。
- 选择 `schema-error` 后 call：`state=schema-error`、`error-kind=宿主参数校验`、`calls=0`；日志同时有 prompt 长度和 count 范围错误。未发送 tools/call。这是本小样宿主预校验策略，不保证所有宿主都同样拦截。
- 选择 `valid` 后 call：`state=submitted`、`calls=1`；请求 method 是 `tools/call`、name 是 `generate_image`、arguments 包含 wait:false。结果 text 中有 `submitted` 数组、`generations` 和查询提示；不显示图片已完成。
- 选择 `rpc-error` 后 call：`state=rpc-error`；响应为 `error`，code `-32601`，method 故意为不存在的 `tools/generate`。
- 选择 `tool-error` 后 call：`state=tool-error`；响应仍有 `result`，其 `isError=true`，与 JSON-RPC error 分开。
- reset 回到 phase 0、calls 0、valid 场景。

`calls` 计数是发出的调用请求，包括协议方法错误；宿主预校验拦截不增加。协议版本 2025-06-18 是固定示例口径，不宣称最新。schema 仅节选 prompt / count / wait 三个实际字段，不冒充完整服务工具清单。count schema 没有声明 default；合法调用显式填写 count:1，省略时取 1 是后端业务默认。prompt 用 Array.from 计数，和已核对的 Zod 4.6.5 codePointLength 相同。各工具调用是固定报文夹具，不假称网络实测。重复合法提交使用递增演示编号，避免暗示生图提交天然幂等。

## 04 · 原编号查询台

按钮 action：`submit`、`advance`、`query`、`timeout`、`fail`、`reset`。可选 `cancel`，脚本也支持它。

读数：`job-id`、`server-state`、`client-state`、`submissions`、`queries`。

初值：服务器尚未提交，客户端等待开始，两个计数都是 0。只有 submit 可用。提交后固定任务编号 `gen-demo-001`，提交次数 1，并禁用 submit。每次 query 只增加查询次数。

推荐验收：

1. submit → `serverState=queued`、`clientState=submitted`、`submissions=1`。
2. advance → `serverState=running`，客户端仍 `submitted`，没有自动收到服务变化。
3. timeout → `clientState=timed-out`，服务端仍 running，提交数仍 1。
4. advance → 服务端 completed，客户端仍 timed-out。
5. query → 日志 `get_generation({"id":"gen-demo-001"})`，`observed=completed`、clientState=observed、queries=1，结果 images 有 file/url/mime。提交数仍 1。已查到完成文件，尚未宣称通过画面验收。
6. 再次 query → queries=2，仍同一 id，submissions=1。
7. reset；submit → fail → query，得到 failed 与固定 error 信息，终态后禁用 advance / fail。

可选 cancelled 路径：reset → submit → cancel → query。客户端超时不会自动取消服务端任务。实际服务状态使用 completed，而非 succeeded。queued / running / completed / failed / cancelled 与 submitted / generation 都属于画境业务合同；没有泛化成 MCP 协议任务状态。

## 05 · 故障定位与文件验收

按钮 action `case`，value 为以下之一：`skill-missing`、`tool-hidden`、`bad-arguments`、`service-failed`、`bad-file`、`wrong-size`、`ok`。另有 `inspect`、`reset`。

读数：`location`、`format`、`dimensions`、`accepted`。

初值：case=skill-missing，state=ready，未检查。选择场景仅选择夹具，不立即验收。

inspect 是短异步操作，测试等待 `#demo5.dataset.state` 为 `blocked` / `rejected` / `accepted` 再断言：

| case | state | 关键结果 |
|---|---|---|
| skill-missing | blocked | 定位 技能发现 / 加载，尚无文件 |
| tool-hidden | blocked | 定位 宿主工具暴露，尚无文件 |
| bad-arguments | blocked | 定位 参数组装 / 校验，尚无文件 |
| service-failed | blocked | 定位 生图服务 / 上游，尚无文件 |
| bad-file | rejected | HTML / 非 PNG，日志真实读取前 8 字节，对照 PNG 签名 |
| wrong-size | rejected | PNG · 已解码，1024 × 1536，与固定合同不符 |
| ok | accepted | PNG · 已解码，1536 × 1024，文件检查通过 |

容器 `dataset.accepted` 只有 ok 成功检查后为 `true`。每次选择场景都会清空上一轮验收结果。reset 回到 skill-missing、未检查、accepted=false。

验收不是仅比较后缀：bad-file 的 `.png` 内容是 HTML 字节；另外两个 PNG 由浏览器 Canvas 本地生成，再读取 PNG signature / IHDR，最后用本地 data URL 交给浏览器实际解码并核对尺寸。没有图片下载或外部网络。正确 PNG 的画面仅是固定色块夹具，不是模型输出；即使文件检查通过，画面是否解释正文仍需人工目检。1536 × 1024 是本文小样交付合同，不是所有生图模型的尺寸保证。

## 建议页面说明

每枚互动的 demo-foot 应写清固定模拟口径、重放方式、值得观察的状态。第 05 枚注明 PNG 文件检查实际在浏览器执行，生成任务与其他故障仍为固定夹具。所有 log 允许阅读 / 横向滚动；移动端限制在容器宽度内。
