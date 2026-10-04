"""Run the vendored Agent Blueprint pipeline with an existing OpenAI-compatible model.

The upstream pipeline and rules are unchanged. Only its model transport is adapted
to providers already configured in Zaowufang. Input arrives over stdin so the
product idea is never exposed in a process command line.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from blueprint.forward import run_plan
from blueprint.llm import Budget, BudgetExceeded, StageOutputInvalid, extract_json
from blueprint.schema import validate


class OpenAICompatibleRunner:
    name = "zaowufang-openai-compatible"

    def __init__(self) -> None:
        self.base_url = os.environ["AIONUI_BLUEPRINT_BASE_URL"].rstrip("/")
        self.api_key = os.environ["AIONUI_BLUEPRINT_API_KEY"]
        self.model = os.environ["AIONUI_BLUEPRINT_MODEL"]
        self.budget = Budget(max_calls=12, max_tokens=160_000)

    def complete(self, stage: str, system: str, prompt: str, schema: dict) -> dict:
        messages = [{"role": "user", "content": prompt}]
        errors: list[str] = []
        for _attempt in range(2):
            self.budget.check()
            request_payload = {
                "model": self.model,
                "messages": [{"role": "system", "content": system}, *messages],
                "max_tokens": 8192,
            }
            # Qwen3.8 defaults to very deep reasoning. Blueprint already
            # separates planning and review into distinct stages, so use the
            # provider's documented non-thinking setting for this JSON flow.
            if self.model.lower().startswith("qwen3.8-"):
                request_payload["reasoning_effort"] = "none"
                request_payload["response_format"] = {"type": "json_object"}
            body = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
            request = urllib.request.Request(
                f"{self.base_url}/chat/completions",
                data=body,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    payload = json.load(response)
            except urllib.error.HTTPError as error:
                raise RuntimeError(f"模型接口返回 HTTP {error.code}，请检查当前模型配置") from error
            except urllib.error.URLError as error:
                raise RuntimeError("无法连接当前模型接口") from error
            except TimeoutError as error:
                raise RuntimeError(f"阶段 {stage} 的模型请求在 120 秒内未完成") from error

            usage = payload.get("usage") or {}
            self.budget.record(stage, usage.get("prompt_tokens") or 0, usage.get("completion_tokens") or 0)
            choices = payload.get("choices") or []
            message = choices[0].get("message") if choices else None
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str) or not content.strip():
                raise StageOutputInvalid(f"阶段 {stage} 的模型响应为空")
            try:
                data = extract_json(content)
                errors = validate(schema, data)
            except (StageOutputInvalid, ValueError) as error:
                errors = [str(error)]
            else:
                if not errors:
                    return data
            messages.extend([
                {"role": "assistant", "content": content},
                {"role": "user", "content": "上一次输出不合格式：\n- " + "\n- ".join(errors)
                 + "\n请只输出符合结构的 JSON 对象。"},
            ])
        raise StageOutputInvalid(f"阶段 {stage} 两次输出都不合格式：{errors}")


def main() -> int:
    payload = json.load(sys.stdin)
    idea = payload.get("idea")
    output_dir = payload.get("output_dir")
    if not isinstance(idea, str) or not idea.strip():
        raise ValueError("产品想法不能为空")
    if not isinstance(output_dir, str) or not output_dir:
        raise ValueError("缺少输出目录")
    runner = OpenAICompatibleRunner()
    plan, document = run_plan(idea, runner, Path(output_dir), log=lambda line: print(line, file=sys.stderr))
    json.dump({
        "document": str(document),
        "title": plan.title,
        "unknowns": plan.extract.get("unknowns", []),
        "components": [item.get("id") for item in plan.components],
        "model": runner.model,
        "calls": runner.budget.calls,
        "review_ok": bool(plan.review.get("ok")),
    }, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, ValueError, BudgetExceeded, StageOutputInvalid, RuntimeError) as error:
        print(f"Agent Blueprint 运行失败：{error}", file=sys.stderr)
        raise SystemExit(1)
