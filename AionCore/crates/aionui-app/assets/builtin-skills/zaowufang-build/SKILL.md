---
name: zaowufang-build
description: Implement an approved product requirement in a real workspace and hand over code with verification evidence.
---

# 项目实现与交接

适用于用户已确认需求，要求开发 Bot 在工作区修改代码时。

1. 读取已确认的 PRD、现有项目说明和相关代码，列出本次对应的验收条件。若 PRD 与代码现状冲突，先说明并解决。
   - 先用 `project_workflow_status` 读取工作区状态，再用 `project_start_development` 核对 PRD 的确认记录和文件版本。工具拒绝时停止开发，不靠口头“已经确认”绕过。
2. 在当前项目技术栈内实施，复用已有能力；不要为单个功能引入第二套框架、Agent 内核或重复的权限机制。
   - 借鉴 `ai-product-starter-kit` 的阶段顺序：先核对技术适配与费用／权限边界，再做最小可运行的数据和后端路径，最后做对应界面。不要强行改为手册举例的 Python、Next.js 或特定云平台。
3. 运行与改动有关的检查并记录结果。无法运行的检查要说明原因和剩余风险。
4. 交付时列出代码位置、运行或体验步骤、测试证据、未完成项，并逐条对应验收条件。交给测试 Bot 的内容应能独立复现。调用 `project_handoff_to_test` 保存实际文件和验证结果；失败时保持开发中状态。

工作区的 `.zaowufang/project-workflow.json` 是跨 Bot 阶段记录。不要手工修改它或伪造检查结果；由流程工具维护。关键数据、费用、权限和上线操作必须按当前项目约束处理，不能因为通用手册说“下一阶段”就跳过用户确认。

没有实际执行的构建、测试或部署，不能写成已完成。
