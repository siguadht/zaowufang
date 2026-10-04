---
name: zaowufang-prd
description: Turn a product idea into a reviewable PRD, user stories, scope, and acceptance criteria before implementation.
---

# 产品需求与 PRD

适用于用户要从想法开始规划产品、梳理需求或准备交给开发时。

每次生成或修订 PRD，首先调用 `agent_blueprint_plan`。若已知当前会话工作区的绝对路径，传入 `workspace_dir` 让方案出现在任务文件中；未知时仍需调用。该工具使用单独的 Agent Blueprint 引擎，保存架构方案；它的输出是 PRD 的分析输入之一，不是 PRD 成品。若 `review_ok=false`，把方案标为待完善草稿并列出待确认信息。失败时如实说明，不能用模型自行编造“Blueprint 已运行”。

1. 先核对目标用户、核心问题、使用场景和现有资料。缺少关键决定时，提出具体问题；可由常识推断的细节要标为假设。
2. 明确 MVP 范围、暂缓事项和成功标准。把功能写成用户能完成的任务，给每项功能写可检查的验收条件。
3. 形成可评审的 PRD：背景、目标、用户与场景、主要流程、功能范围、异常路径、数据和权限、验收标准、风险与待确认问题。
4. 在用户确认需求前，不把草稿说成已批准方案。交给开发 Bot 时，附上 PRD 文件路径、确定的范围、尚未解决的问题和验收条件。

输出优先保存到当前工作区的文档文件，避免只留在聊天记录里。不要编造调研数据。
