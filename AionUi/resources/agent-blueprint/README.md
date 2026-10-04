# Agent Blueprint integration

`blueprint/` contains only the upstream planning pipeline, rules, schemas, renderer and prompt files from the user-provided `agent-blueprint-main.zip` (MIT license; see `LICENSE`). The upstream project is <https://github.com/hubooooooo/agent-blueprint>.

`run_plan.py` is the Zaowufang adapter. It runs the upstream `run_plan` pipeline and sends its stage requests through the OpenAI-compatible model already configured in Zaowufang. The original CLI's Anthropic-only runner, reverse audit path and 17 standalone reference implementations are not part of this integration.

For Qwen3.8 models, the adapter uses the provider's non-thinking JSON mode so the full multi-stage pipeline completes within an interactive task. The MCP tool accepts an optional absolute `workspace_dir`; without it, plans are saved under the app data directory. Each result returns the actual document path and review status.

The packaged macOS app includes a local Python 3.12 runtime under `python/`. That directory is a build asset and is intentionally not checked into Git. A packaging machine must populate it with a relocatable Python 3.12 installation before building; otherwise the MCP server is registered as unavailable. The Python runtime retains its own license in the bundled distribution.
