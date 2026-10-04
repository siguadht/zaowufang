/**
 * @license
 * Copyright 2026 Zaowufang contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/** MCP adapter for the vendored, MIT-licensed Agent Blueprint planning engine. */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SERVER_NAME = 'zaowufang-agent-blueprint';
const MAX_IDEA_LENGTH = 40_000;
const MAX_OUTPUT_LENGTH = 24_000;
const RUN_TIMEOUT_MS = 8 * 60_000;

type PlanResult = {
  document: string;
  title: string;
  unknowns: unknown[];
  components: string[];
  model: string;
  calls: number;
  review_ok: boolean;
};

function runBlueprint(idea: string, workspaceDir?: string): Promise<PlanResult> {
  const home = process.env.AIONUI_BLUEPRINT_HOME;
  const python = process.env.AIONUI_BLUEPRINT_PYTHON;
  if (!home || !python || !existsSync(path.join(home, 'run_plan.py'))) {
    return Promise.reject(new Error('Agent Blueprint 引擎或 Python 运行环境未安装。'));
  }
  if (!process.env.AIONUI_BLUEPRINT_API_KEY || !process.env.AIONUI_BLUEPRINT_MODEL) {
    return Promise.reject(new Error('未找到造物坊已配置的可用模型。'));
  }
  if (
    workspaceDir &&
    (!path.isAbsolute(workspaceDir) || !existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory())
  ) {
    return Promise.reject(new Error('工作区路径必须是已存在的绝对目录。'));
  }
  const outputDir = path.join(workspaceDir || process.cwd(), 'agent-blueprint', `${Date.now()}-${process.pid}`);
  mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(python, [path.join(home, 'run_plan.py')], {
      cwd: home,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Agent Blueprint 运行超时，已完成的阶段保留在工作区。'));
    }, RUN_TIMEOUT_MS);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4000)));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Agent Blueprint 退出码 ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PlanResult);
      } catch {
        reject(new Error('Agent Blueprint 未返回有效的方案索引。'));
      }
    });
    child.stdin.end(JSON.stringify({ idea, output_dir: outputDir }));
  });
}

async function main(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: '1.0.0' });
  server.tool(
    'agent_blueprint_plan',
    'Before writing or revising any PRD, run the real Agent Blueprint five-stage planning engine with the user idea. It saves a separate Agent architecture plan in the conversation workspace. Use its verified facts and open questions in the PRD; never present its architecture plan as the PRD itself.',
    {
      idea: z.string().min(1).max(MAX_IDEA_LENGTH).describe('The user idea or current PRD requirements to analyse.'),
      workspace_dir: z
        .string()
        .optional()
        .describe(
          'Absolute path of this conversation workspace. If known, save the Blueprint plan there so it appears with task files.'
        ),
    },
    async ({ idea, workspace_dir }) => {
      try {
        const result = await runBlueprint(idea, workspace_dir);
        const planText = readFileSync(result.document, 'utf8');
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ...result,
                  plan: planText.slice(0, MAX_OUTPUT_LENGTH),
                  truncated: planText.length > MAX_OUTPUT_LENGTH,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[agent-blueprint] plan failed: ${message}\n`);
        return { content: [{ type: 'text' as const, text: `Agent Blueprint 未完成：${message}` }], isError: true };
      }
    }
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  process.stderr.write(
    `[agent-blueprint] MCP startup failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
