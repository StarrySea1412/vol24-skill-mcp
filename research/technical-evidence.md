# 《把流程接上工具》技术取证

核对日期：2026-11-24（Asia/Shanghai）。仅源码与官方资料取证；本报告没有执行生图、运行测试或声称真实调用成功。未读取渠道密钥。

## 一、最适合正文的边界

Skill 是装有知识、工作流程及可选脚本/参考/素材的目录；MCP 是宿主与服务交换工具、资源和提示模板的协议。模型选择下一步，宿主负责读取技能、管理连接和调用，服务执行业务函数。MCP 不规定模型如何组织上下文，也不替文章定义审美与交付标准。

本机有两条现成的真实路线，通往同一个画境 HTTP 服务：

1. `Skill → node scripts/huajing.mjs → HTTP /api/generations → 画境队列 → 渠道`。
2. `Skill 的做法 → 宿主 MCP client → stdio MCP server → HTTP /api/generations → 画境队列 → 渠道`。

第一条已经证明 Skill 不依赖 MCP。第二条中的 Skill 可以规定“先检索旧图、再明确用途与比例、生成后核验”；MCP 工具清单本身不会自动保证这段业务流程。MCP 也能在没有额外 Skill 的宿主里被直接调用。

## 二、本机真实标本

- MCP：`D:/project/ai-image-studio/src/mcp-server.js`。
- 技能正文：`D:/project/ai-image-studio/clawhub-skill/huajing-image-gen/SKILL.md`，80 行。
- 技能脚本：`D:/project/ai-image-studio/clawhub-skill/huajing-image-gen/scripts/huajing.mjs`，239 行。
- 业务 HTTP 服务：`D:/project/ai-image-studio/src/server.js`。
- 既有测试仅作为源码证据：`D:/project/ai-image-studio/tests/mcp-server.test.js`。本次没有运行。
- 旧文：VOL.07《把能力打包成技能》、VOL.15《给 Agent 发一套趁手的工具》。分别已正面讲技能包、description、脚本治理与 MCP 握手、schema、长任务；新篇宜沿同一业务任务串联两层。

### MCP 代理的真实行为

`mcp-server.js:1-10` 明确它是 stdio 薄代理，经 HTTP 调画境，避免直接改图库数据文件。stdout 只传协议，诊断走 stderr。

- `mcp-server.js:23-27`：自动拉起预算 40 秒；单次本机 HTTP 调用默认 30 秒；内部轮询间隔 2 秒；生成默认等待 240 秒，最多 600 秒。这些全部是本服务参数，不是 MCP 统一限额。
- `mcp-server.js:62-87`：通过 `AIS_INSTANCE_URL` 或实例发现连接；发现不到可后台自动启动；并发共用一次发现/启动。
- `mcp-server.js:90-118`：本机连接失败会清掉缓存重新发现并重试一次。HTTP 非成功状态保留业务错误 code/message。
- `mcp-server.js:246`：服务标识 `{name:'ai-image-studio',version:'0.1.0'}`。
- `tests/mcp-server.test.js:85-90`：预期清单是 13 个工具（这是既有测试断言，不是本次实际 `tools/list` 输出）。

### 本篇所需工具与参数

| 工具 | 输入 | 实际输出/限制 | 源码 |
|---|---|---|---|
| `list_providers` | `{}` | 只返回脱敏字段：id/name/enabled、各角色模型、authConfigured/baseUrl | mcp-server.js:257-275 |
| `list_models` | `{providerId:string}` | models 的 id 与 capabilities | mcp-server.js:278-289 |
| `search_library` | `{query?:string,favorite?:boolean,limit?:integer}` | limit 1-60，默认20；返回 total/hasMore/generations（首张图片路径） | mcp-server.js:341-369 |
| `generate_image` | 见下 | 提交或等待生成，返回内容块中的 JSON 字符串 | mcp-server.js:292-327 |
| `get_generation` | **`{id:string}`** | 内容 JSON 是 **`{generation:compactRow}`**；没有 `get_job` 工具 | mcp-server.js:330-338 |

`generate_image` 的 zod 输入定义：

```text
prompt          string，必填，长度 1-12000
providerId      optional string；省略选第一个 enabled 且有 imageModel 的渠道
model           optional string；省略用渠道默认
size            optional string；schema 本身只检查 string，业务范围在 HTTP 服务校验
count           optional integer，1-4，默认由后端取1
negativePrompt  optional string，最多4000
wait            boolean，默认 true
waitSeconds     optional integer，5-600，默认240
```

`mcp-server.js:211-218` 自动选择只看 enabled 与 imageModel，不等于“保证选到 GPT”或“保证凭证与额度可用”。本文若坚持 GPT 配图，应在规程中核对并显式指定渠道/模型。

`src/server.js:2484-2495` 才是 `size` 的真实验证位置：接受 `auto`；宽高均 256-2048，均为64倍数；总像素最多 3,145,728。`1536x1024` 合法。**这些是画境此版本的限制，不能写成 GPT 模型或 MCP 通用限制。**

### 提交与查询结果形状

下列是依照源码写出的讲解示例，固定 ID 并非实际生成记录：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "generate_image",
    "arguments": {"prompt":"纸面工作台上的规程与工具接口","providerId":"example-gpt-provider","size":"1536x1024","count":1,"wait":false}
  }
}
```

`wait:false` 的工具结果 `content[0].text` 解析后是：

```json
{"submitted":["gen-demo-001"],"generations":[{"id":"gen-demo-001","status":"queued"}],"hint":"用 get_generation 查询进度"}
```

此处省略了 title/prompt/model/providerName/size/count/createdAt/images 等 compact 字段，不能称为原样实测响应。

查询参数：`{name:'get_generation',arguments:{id:'gen-demo-001'}}`。

结果 `content[0].text` 解析后：`{generation:{id,status,title,prompt,model,providerName,size,count,createdAt,error?:{code,message},images:[{file,url,mime}]}}`。file 由图库目录与文件名拼成绝对路径（`mcp-server.js:127-169`）。

默认等待生成的结果是 `{timedOut:boolean,generations:[compactRows],hint?:string}`（`mcp-server.js:324-327`）。完成后可能附 image 内容块；只附第一张已完成图，文件≤5MiB且 MIME 属于 PNG/JPEG/WebP/GIF（`mcp-server.js:194-208`）。`get_generation` 本身只返回文本 JSON，没有自动附图。

### 生命周期、回执与验收

- `src/server.js:895-929`：一次 `count` 多张请求被拆成每张一条独立任务；持久化 queued 后 HTTP 返回 **202**。HTTP 回执只说明本服务受理。
- `src/server.js:1414-1421`：worker 进入 running。
- `src/server.js:1488-1507`：下载/保存后更新 completed，写入 file/url/mime/bytes、可读尺寸及 sha256。
- `src/server.js:1515-1527`：业务执行失败写 failed 与规范化错误；另有 cancelled 终态。
- queued/running/completed/failed/cancelled、任务 ID、get_generation 均是**画境业务合同**。它们不是 MCP `tools/call` 必带字段。
- completed 说明本服务保存了图，不说明它符合文章用途、风格、尺寸预算或网页显示要求。规程还要读文件、核验魔数/尺寸并目检，再复制到文章 assets 并核对引用。
- `src/server.js:2547-2564`：服务重启后，同步生成若没有可续接远端任务 ID，结果不确定，标 `GENERATION_INTERRUPTED` 并停止自动重提；已知远端 ID 才能续查。不能把“我没收到结果”直接等同“上游没生成”。

## 三、Skill 与 CLI 的真实契约

- `SKILL.md:2-8`：description 明写 create/generate image、polish prompt、look up previously generated images；本机服务默认4173、Node18+是前提。
- `SKILL.md:37-38`：文档约定 JSON stdout、诊断 stderr；退出码0成功、1生成失败、2服务不可达、3用法错。
- `huajing.mjs:5-8`：只 import node:process；HTTP 用内置 fetch；`HUAJING_BASE_URL` 与 `HUAJING_DATA_DIR` 可覆盖。
- `huajing.mjs:55-75`：HTTP与连接错误；`fail` 将诊断写 stderr 后退出。**不要照搬旧文说“所有错误都在 JSON error 字段”**，此脚本实际失败大多不产生 stdout JSON。
- `huajing.mjs:107-110`：5秒 health 请求，ok 不是true则退出2。
- `huajing.mjs:113-127`：CLI provider 可按 id或不区分大小写名称；默认优先已配认证的 enabled/imageModel 渠道。
- `huajing.mjs:130-144`：查询间隔1/2/3秒然后保持3秒；completed终止；failed退出1；超过本地预算提示“task may still finish”，保留任务ID。
- `huajing.mjs:160-192`：CLI count 会截到1-4（不同于 MCP schema 的严格拒绝）；默认超时300秒；先 health，再提交；顺次查每个任务。
- `huajing.mjs:212-231`：gallery 走 GET /api/generations，limit 默认5最多200；completed 才给图片条目。

**文档与源码应分开描述**：退出码1涵盖生成失败与等待超时；超时不是远端取消，也不自动证明终态失败。此版轮询只显式识别 completed/failed，cancelled会继续等至超时；本篇交互可用五态解释业务合同，但别声称此脚本已对五态逐一恢复。

## 四、五类常见故障与修哪一层

| 现象 | 边界与证据 | 下一步 |
|---|---|---|
| 装了Skill却没按规程做 | 触发/激活/宿主上下文；不是MCP握手的职责 | 核对description和本轮是否实际读取SKILL.md；显式调用可协助定位 |
| `get_job`或旧工具名不存在 | 清单与调用名失配；未知工具属于协议错误 | 重新 `tools/list`，与name逐字对照，不猜名字 |
| count=5或size=1619x972 | 参数合法性；count在MCP schema拒绝，size在本机HTTP验证拒绝 | 根据当前schema和服务限制修参；失败时不重试原参数 |
| MCP已连接却没有可用渠道/服务失联 | MCP连接、HTTP服务、渠道凭证是不同环节 | 列渠道检查enabled/imageModel；核对实例地址，依据工具执行错误处理 |
| 返回queued或本地wait预算用完 | 受理/等待/业务终态分离 | 保存任务ID继续查询已有任务；确认终态前不要重新提交；completed后还需交付验收 |

## 五、官方来源及可引用句子

官方站点 `agentskills.io` 与 `modelcontextprotocol.io` 本次直连均超时；以下资料已经从各自官方 GitHub 仓库实际读取。站点链接可放正文供读者访问，GitHub路径作为取证替代。

### Agent Skills

1. https://agentskills.io/home （官方GitHub： https://github.com/agentskills/agentskills/blob/main/docs/home.mdx ）
   - “At its core, a skill is a folder containing a SKILL.md file.”
   - 允许脚本、参考材料、模板与其他资源。
   - Discovery：先读name/description；Activation：相关时读整份正文；Execution：按需代码/引用。
2. https://agentskills.io/specification （官方GitHub： https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx ）
   - 源码27-32行：name与description必填；description最多1024字符；allowed-tools是实验性、宿主支持可能不同。
   - 源码216-224行：渐进加载三级；metadata约100 tokens；instructions建议<5000 tokens；resources按需；SKILL.md建议<500行。
   - token数与行数是规范建议，不是不同宿主执行行为的保证。

### MCP（报文小样固定按2025-06-18版本说明，不宣称最新版）

3. https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
   官方GitHub： https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/basic/lifecycle.mdx
   - 第40行：初始化必须是第一次交互；第59/83行的请求/响应示例协议版本是2025-06-18。
   - 第113行：notifications/initialized。
   - 第125-135行：服务器若支持请求版就回同版，否则回自身支持版；客户端不支持回版则应断开。**不要写“双方自动就高不就低”**。
   - 第204-214行：请求等待超时与取消通知是协议层建议；画境waitSeconds和业务任务生命周期另定。
4. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
   官方GitHub： https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/server/tools.mdx
   - 第55/102行：tools/list、tools/call。
   - 第187-188行：inputSchema与可选outputSchema。
   - 第388-424行：协议错误（未知工具/无效参数等）与执行错误isError:true；未知工具例 error.code=-32602；API失败例 result.content文本 + isError:true。
   - 该画境服务通过content文本传JSON，没有注册outputSchema/structuredContent，不该改写成它已用标准结构输出。
5. https://modelcontextprotocol.io/docs/2025-06-18/learn/architecture
   官方GitHub： https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/docs/2025-06-18/learn/architecture.mdx
   - MCP聚焦上下文交换，不规定宿主如何使用LLM或管理上下文。
   - 区分host/client/server；服务端可暴露tools/resources/prompts三类。
   - 模型决策，宿主路由执行并回填结果；本服务只有13个tools，不代表MCP只有tools。

## 六、互动口径建议

小样固定任务 `gen-demo-001`、固定输出1536×1024、按按钮推进时钟。页脚写明“依照上述源码合同构造的确定性模型；不是模型真实触发实验或上游生图实测”。

建议三个对照：流程来源（Skill）、接入方式（CLI/MCP）、完成证据（202/业务终态/文件与视觉验收）。触发演示用固定规则推演，不编造真实模型触发概率。
