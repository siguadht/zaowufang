---
name: zaowufang-build
description: Implement an approved product requirement in a real workspace and hand over code with verification evidence.
---

# 项目实现与交接

适用于用户已确认需求，要求开发 Bot 在工作区修改代码时。

1. 读取已确认的 PRD、现有项目说明和相关代码，列出本次对应的验收条件。若 PRD 与代码现状冲突，先说明并解决。
2. 在当前项目技术栈内实施，复用已有能力；不要为单个功能引入第二套框架、Agent 内核或重复的权限机制。
3. 运行与改动有关的检查并记录结果。无法运行的检查要说明原因和剩余风险。
4. 交付时列出代码位置、运行或体验步骤、测试证据、未完成项，并逐条对应验收条件。交给测试 Bot 的内容应能独立复现。

没有实际执行的构建、测试或部署，不能写成已完成。
