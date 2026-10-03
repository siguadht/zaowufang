# Granto · 造物坊

[简体中文](README.md) · [English](README.en.md)

**Keep ideas, source material, and AI work in one place.** Granto is a macOS desktop app where you can talk to role based Bots, work in a selected project folder, and review conversations and files as product, development, QA, and office tasks progress.

> This is a preview you can try today. Moving work between Bots requires your review and action; the app does not automatically take a PRD all the way to deployment.

![Granto home screen with the workbench, task entry, and four Bots](docs/images/zaowufang-home.png)

## Work with four Bots

| Bot | Use it for | Typical outputs |
| --- | --- | --- |
| 🔵 Product Bot | Define users, needs, scope, and flows | Product brief, PRD, user stories, acceptance criteria |
| 🟠 Developer Bot | Implement approved requirements in a selected workspace | Code, run instructions, verification results |
| 🟣 QA Bot | Check work against acceptance criteria | Test notes, reproducible issues, evidence |
| 🩷 Office Bot | Research, organize material, and handle office work | Reports, documents, and other office deliverables |

Pick a Bot on the home screen, enter a task, and choose a project folder to start a conversation. **Task List** shows real conversations and their runtime status. **Deliverables** shows files associated with each conversation's workspace. You can review the Product Bot's plan before handing approved requirements to the Developer Bot, then ask the QA Bot to check the result.

### Conversation view

![Granto Product Bot conversation view demonstration](docs/images/zaowufang-chat-demo.png)

This is a screenshot of the installed app. The reading tracker conversation was **inserted as sample content** to show the message layout, Bot, and project file panel. It is not a real model response, and the PRD mentioned in the sample was not generated. To send real messages, configure a working model or supported local agent first.

## Try it

1. Download the Apple Silicon macOS build from the [release page](https://github.com/siguadht/zaowufang/releases/tag/v2.2.3-zaowufang-sidebar-alignment).
2. Configure a supported model provider and API key, or a supported local agent/model, in Settings. Availability and charges depend on the provider.
3. Choose a Bot and project folder, then describe your task. A practical starting point is to have Product Bot draft requirements, review them, then move to Developer Bot and QA Bot.

This is a human guided workflow. Automatic stage transitions, automatic publishing, and unattended deployment are not implemented. Results also depend on the capabilities of the chosen model, agent, and tools.

## Project and licenses

`AionUi/` contains the Electron frontend; `AionCore/` contains the Rust backend. See the [product brief](docs/PRODUCT_BRIEF.md) and [PRD](docs/ZAOWUFANG_PRD.md) for scope and decisions.

Granto is adapted from [Product Manager Workbench](https://github.com/Zhouchengjian-user/product-manager-workbench), which builds on [AionUi](https://github.com/iOfficeAI/AionUi) and [AionCore](https://github.com/iOfficeAI/AionCore). The source baseline is commit `d3179fecb1e528b6a952e58464f08ed434eca33e`. The original README is preserved at [docs/ORIGINAL_PROJECT_README.md](docs/ORIGINAL_PROJECT_README.md). See [LICENSE](LICENSE), [NOTICE](NOTICE), [AionUi/LICENSE](AionUi/LICENSE), and [AionCore/LICENSE](AionCore/LICENSE) for attribution and license terms.

“Granto / 造物坊” is the name of this adaptation; it does not imply endorsement by the original author or upstream projects.
