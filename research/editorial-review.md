# VOL.24 最后技术审稿

审阅日期：2026-11-24（Asia/Shanghai）。只读审阅 index.html、demos.js、SVG、取证与生成记录，并对照昨天 VOL.23 第六章、本机画境源码、实际 tools/list 观察和官方规范。未修改页面或脚本，未扩展测试。

## 结论

没有发现阻止交付的核心事实错误。Skill 能独立走脚本、MCP 与本机 HTTP 是不同连接、通知没有 id、查询沿原任务 ID、completed 后继续文件与画面验收，这些边界均已写清楚。建议在发布前处理下列三处小修。

## 建议修改

### 1. 小样给 count schema 增加了真实清单没有的 default

位置：demos.js:214，IMAGE_SCHEMA.properties.count。

当前是：

`count: { type: 'integer', minimum: 1, maximum: 4, default: 1 }`

实际 tools/list 的 count 字段有 type/minimum/maximum/description，**没有 default 键**。默认1属于该服务的描述与后端行为。当前 index.html 的小样图注又说“schema 只节选三个真实字段”，会让读者误以为 default 也是原样来自清单。

建议移除这里的 `default: 1`；正文表格已有“省略时后端取1”，保留即可。

依据：research/mcp-observation.json 中 generate_image.inputSchema.properties.count；源 mcp-server.js:300；HTTP 服务 server.js:902。

### 2. 一次等待预算用完，被追问标题叫成连接超时

位置：index.html:180（检视时行号；定位经典追问“连接已经超时，为什么还要保留那个编号？”）。

此节刚讲 MCP 包装器默认240秒的 waitSeconds 预算；它到期可以通过仍工作的 MCP 连接正常返回 timedOut。连接超时、请求等待超时、业务任务失败是不同的观察。

建议将追问改为“本次等待已经超时，为什么还要保留那个编号？”，其余推理成立。这样与本节互动一致，不误导读者以为本机 stdio 已经断开。

依据：mcp-server.js:221-240、324-327；MCP 2025-06-18 生命周期 Timeouts。

### 3. 路线台把 Skill 作为正在执行的负责者

位置：demos.js:78，HTTP 路线第二步的 owner 当前写 `Skill`。

技能是流程材料，真正“取出流程与材料、确定用途、比例和风格”的是宿主与模型。正文已经准确区分了这一点，动态负责者读数宜保持相同口径。

建议 owner 改为“宿主 + 模型”，步骤名可写“依据 Skill 取流程与材料”。这属于表述一致性小修。

依据：index.html:33、75-79；Agent Skills 官方 home.mdx 的 discovery/activation/execution；MCP architecture 的 host/client/server 与模型调用分工。

## 已核对、应保留的内容

- VOL.23 第六章 669-677 行确实写了 teamhub：56条自身命令 + 99条 connector = 155条，并将“认识一个 CLI”作为减少多 MCP server 的设计意图。VOL.24 开篇沿用上期口径，没有声称本篇复现了 Linger。
- index.html:75-79 与路线台明确：CLI、Skill+HTTP脚本、Skill+MCP 都能通往同一业务服务，没有把 Skill 与 MCP 写成必选配套。
- 素材生成 manifest 明确真实路径是 HTTP API；MCP 实际观察只完成 initialize/initialized/tools/list，toolCalls=0、generationCalls=0。正文把这两种实测分别链接，没有将固定 gen-demo-001 当真实任务。
- 报文台 initialize/通知/tools/list 正常顺序；initialized 无 id；错误协议方法 tools/generate 用 JSON-RPC -32601；API执行故障用 result.isError，未混淆 error 与 result。
- 参数表正确指出：count在MCP工具schema检查，size范围/64倍数/总像素在本机HTTP服务检查。这不是MCP或GPT模型统一限制。
- CLI默认300秒与MCP默认240秒已明确分开；超时不等于取消或上游没生成。
- get_generation 输入是 id:string；返回顶层 generation；wait:false 的 submitted/generations 是按源码节选并标为示例。
- PNG夹具由浏览器Canvas生成，签名/IHDR/浏览器解码实际执行；图注与代码均说不是模型作品、文件通过还要目检。
- 五张生成记录均为噜皮生图 / gpt-image-2.5-sunburst，一次成功，final为1536×1024 WebP；图注称GPT概念插画而非软件截图。
- decoration-generation.json称12帧轻推镜“装饰循环”，明确不表示任务状态；没有假称生成动态状态实测。

## 长度口径补充：无需改当前校验

检视发现本机 Zod 4.6.5 与旧版本的实现不同：node_modules/zod/v4/core/checks.js:271-274 会对字符串采用 codePointLength；demos.js 的 Array.from 计数与 MCP schema 的字符串长度口径一致。**不应将当前小样校验改为 args.prompt.length。**

HTTP业务服务 server.js:897 还用 JavaScript prompt.length（UTF-16单位）再次限制12000，因此包含大量非BMP字符的超长提示可能通过schema而被HTTP服务拒绝。当前小样只使用固定短提示，不存在这个行为分歧；无需为此扩展测试或正文。

## 链接与证据范围

research/mcp-observation.json 已实际观察协议2025-06-18、服务 ai-image-studio/0.1.0、13个工具，且仅保留两个工具schema；标题“握手与工具清单记录”符合记录范围。

research/image-generation.json 保存真实jobId、模型、提交/完成时间、原始与最终图片路径；“真实生成记录”符合内容。research/technical-evidence.md 里的“没有执行生图/测试”说明该次源码取证行为，不是否定后续素材生成，读者可按文件日期与范围理解。

讲解技能片段未安装；演示参考/脚本明确为短夹具；页面给出的本篇 research/visual-brief.md 与 verify/assets.py 文件均存在。未发现把示例、固定报文或概念插画冒称产品实测的链接说明。

## 发布前闭环

上述三处小修已完成：count 的节选 schema 删除了并非真实清单字段的 default；路线负责者写为宿主／模型并说明 Skill 提供规程；追问改为“本次等待已经超时”。码点长度校验保留。最终本地及线上页面均通过同一套 141 项行为、资源、字体与布局检查，0 错误、0 资源失败；五张插画完成真实文件解码与目检。
