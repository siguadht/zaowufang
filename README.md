# 造物坊 Granto

**从想法到交付的 AI 工作台。** 这是基于[产品经理工作台](https://github.com/Zhouchengjian-user/product-manager-workbench)改造的 macOS 桌面产品，沿用 AionUi / AionCore 的模型、工具、会话和工作区能力。

## 四位 Bot

| Bot | 用途 | 典型交付 |
| --- | --- | --- |
| 产品 Bot | 梳理想法与需求 | PRD、用户流程、验收标准 |
| 开发 Bot | 在选定工作区实现需求 | 代码、运行说明、测试结果 |
| 测试 Bot | 对照验收标准核查 | 测试报告、可复现缺陷 |
| 办公 Bot | 研究与日常办公 | 报告、资料整理、文档 |

首页可直接选择 Bot 并发起真实会话。四位 Bot 使用各自的头像、规则和示例任务。产品到开发、开发到测试的交接由用户确认后手动切换 Bot，并把 PRD 或工作区交给下一位；自动状态机、自动发布和无人值守上线尚未实现。

## 开始体验

1. 安装 Apple Silicon 版 macOS 应用“造物坊”。
2. 在设置中添加支持的模型提供商和 API Key，或配置项目支持的本地模型。模型的服务费用和可用性取决于提供商。
3. 在首页选一位 Bot，选择项目文件夹，在输入框描述任务并发送。
4. 先让产品 Bot 产出 PRD；确认后选开发 Bot 实现；再由测试 Bot 验收。涉及文件或代码的任务建议始终选定工作区。

没有模型配置时可以浏览界面与设置，但 AI 任务不会生成结果。不同模型和工具的实际编码能力有所差异。

## 开发

`AionUi/` 是 Electron 前端；`AionCore/` 是 Rust 后端。两个目录保持同级。工程内的 `AionUi/AGENTS.md`、`AionCore/AGENTS.md` 和各自文档提供构建要求。本次 Bot 定义位于 `AionCore/crates/aionui-app/assets/builtin-assistants/`；前端入口位于 `AionUi/packages/desktop/src/renderer/pages/guid/`。

产品范围与决策见 [PRODUCT_BRIEF](docs/PRODUCT_BRIEF.md) 和 [PRD](docs/ZAOWUFANG_PRD.md)。

## 来源与许可

本版本基于原仓库提交 `d3179fecb1e528b6a952e58464f08ed434eca33e`。原项目由周承健基于 [AionUi](https://github.com/iOfficeAI/AionUi) 和 [AionCore](https://github.com/iOfficeAI/AionCore) 定制开发。原项目 README 保存在 [docs/ORIGINAL_PROJECT_README.md](docs/ORIGINAL_PROJECT_README.md)；版权与许可声明见 [LICENSE](LICENSE)、[NOTICE](NOTICE)、[AionUi/LICENSE](AionUi/LICENSE) 和 [AionCore/LICENSE](AionCore/LICENSE)。

“造物坊”是此改版的产品名，不表示原作者或上游项目为它背书。
