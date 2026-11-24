# 把流程接上工具 · 造物手记 VOL.24

接着昨天 VOL.23《别人家的造物：Linger》的 155 条 CLI 命令，沿一张文章插图拆 Skill 与 MCP 的协作：同一任务三条路线、技能渐进加载、MCP 握手与参数契约、同编号等待、文件与画面验收。

在线阅读：[VOL.24 把流程接上工具](https://starrysea1412.github.io/vol24-skill-mcp/)

5 章 · 5 段可重放互动 · 5 张 GPT 章节插画 · 2 张机制 SVG · 1 段装饰 GIF。HTML/CSS/JS 与文楷字体均本地提供，页面不依赖远程运行库。沿用 VOL.23 的纸色、文楷、蓝墨与赭色版式。

## 证据与口径

- 本机画境的 MCP/HTTP/Skill 脚本取证在 `research/technical-evidence.md`，核对日期 2026-11-24。
- `research/mcp-observation.json` 是实际 initialize → initialized 通知 → tools/list 的观察，协商 2025-06-18，发现 13 个工具；此次探针没有调用生图。
- 五张插画按用户选定的画境 HTTP API，通过噜皮 `gpt-image-2.5-sunburst` 生成。每图单独提交，首试成功；原图与成品均 1536×1024，WebP 质量82，无裁切。完整 prompt、任务编号与结果在 `research/image-generation.json`。
- 插画是概念图。GIF 从本篇 01 插画合成 12 帧轻推镜，属于装饰，不代表真实任务状态；减少动态效果时显示静态图。
- 前四枚互动与故障定位使用固定夹具，不预测真实模型触发或复现渠道速度。第五枚实际读取本地 PNG 签名、IHDR、浏览器解码；PNG 是色块夹具，文件合格仍需画面目检。
- `queued/running/completed/failed/cancelled`、等待限额与工具名是画境业务合同。报文小样固定采用 MCP 2025-06-18，不宣称最新版。

## 复跑

无需构建。直接以本机 HTTP 静态服务打开 `index.html`。

```text
node verify/site.cjs                 # 五枚互动、错误路径、键盘与移动端验收
python verify/assets.py              # WebP 解码、尺寸、SVG、GIF与文件摘要
node research/mcp-probe.mjs          # 零付费的本机握手和工具发现
```

页面验收需要 `playwright-core` 与本机 Edge，可通过 `NODE_PATH` 指定模块目录。用 `ARTICLE_URL=https://starrysea1412.github.io/vol24-skill-mcp/` 可按相同合同验线上页。PNG/WebP/GIF 检查需要 Pillow。

重新生图脚本 `research/generate-images.mjs` 会调用用户已配置的真实图像渠道，按张生成；记录用于复核，不应把复跑当成零付费测试。

字体使用 LXGW 文楷，OFL 许可证在 `assets/OFL.txt`。`verify/fonts.py` 从提供的正版 TTF 为本篇文字生成 WOFF2 子集，中文缺字检查结果在 `verify/fonts.json`。

本地最终验收：141 项行为、资源、字体和布局检查通过，零 JS / 控制台错误、零资源失败；1440 / 390 / 320px 无整页横向溢出。截图保留在本机 `shots/`，脚本和结果随源码提供。

上一篇：[VOL.23 别人家的造物：Linger](https://starrysea1412.github.io/vol23-linger/) · [全系列目录](https://starrysea1412.github.io/makers-notebook/)
