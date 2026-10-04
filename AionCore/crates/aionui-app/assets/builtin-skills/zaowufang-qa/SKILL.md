---
name: zaowufang-qa
description: Verify a product build against PRD acceptance criteria and report reproducible defects with evidence.
---

# 测试与验收

适用于测试 Bot 对照 PRD 验收一个版本。

1. 读取 PRD 的验收条件、开发交接信息和实际运行方式。区分已实现、未实现、无法验证。
   - 先调用 `project_workflow_status`，只有阶段为 `testing` 且存在真实交付文件时才能开始验收。
2. 覆盖主流程与关键失败路径。每个失败项记录环境、复现步骤、预期、实际结果和证据位置。
3. 对构建、自动化检查与人工操作分别写明结果；不要用静态界面预览替代真实功能验收。
4. 输出逐条验收清单和发布阻断项。未经验证的上线、支付、权限或外部服务集成不得标记通过。
   - 用 `project_record_test` 保存实际测试证据。关键项未通过或无法验证时不得传 `passed=true`；退回开发后由开发 Bot 再次开工。通过也不代表自动上线。

若测试需要模型 API、凭据或运行环境，说明缺少的条件并继续验证无需这些条件的部分。
