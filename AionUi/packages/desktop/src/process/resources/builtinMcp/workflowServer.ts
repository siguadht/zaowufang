/**
 * @license
 * Copyright 2026 Zaowufang contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { confirmPrd, handoffToTest, readWorkflow, recordTest, startDevelopment } from './workflowStore';

const workspace = z.string().min(1).describe('Absolute path of the shared project workspace.');

function result(action: () => unknown) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(action(), null, 2) }] };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

async function main(): Promise<void> {
  const server = new McpServer({ name: 'zaowufang-project-workflow', version: '1.0.0' });
  server.tool(
    'project_workflow_status',
    'Read the saved PRD, development, and test handoff status of a shared project workspace.',
    { workspace_dir: workspace },
    ({ workspace_dir }) => result(() => readWorkflow(workspace_dir))
  );
  server.tool(
    'project_confirm_prd',
    'Product Bot only: call AFTER the human explicitly approves a specific PRD. Never infer approval from a request to draft or revise a PRD. Saves the PRD file hash and user confirmation for Developer Bot.',
    {
      workspace_dir: workspace,
      prd_path: z.string().min(1).describe('Existing Markdown PRD path relative to workspace.'),
      user_confirmation: z.string().min(4).describe('The human user’s explicit approval, quoted accurately.'),
    },
    ({ workspace_dir, prd_path, user_confirmation }) =>
      result(() => confirmPrd(workspace_dir, prd_path, user_confirmation))
  );
  server.tool(
    'project_start_development',
    'Developer Bot: start implementation only when a PRD was explicitly confirmed and its file has not changed. A failed QA review may resume development.',
    { workspace_dir: workspace },
    ({ workspace_dir }) => result(() => startDevelopment(workspace_dir))
  );
  server.tool(
    'project_handoff_to_test',
    'Developer Bot: hand over existing implementation files and actual verification evidence to QA Bot. Do not call if code or checks were not completed.',
    {
      workspace_dir: workspace,
      files: z.array(z.string().min(1)).min(1).describe('Existing implementation files relative to workspace.'),
      verification: z.string().min(12).describe('Commands/checks actually run, results, and remaining risks.'),
    },
    ({ workspace_dir, files, verification }) => result(() => handoffToTest(workspace_dir, files, verification))
  );
  server.tool(
    'project_record_test',
    'QA Bot: record actual test evidence and either accept the implementation or request changes.',
    {
      workspace_dir: workspace,
      passed: z.boolean(),
      evidence: z.string().min(12).describe('Tests actually run and their observed results.'),
    },
    ({ workspace_dir, passed, evidence }) => result(() => recordTest(workspace_dir, passed, evidence))
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  process.stderr.write(
    `[project-workflow] MCP startup failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
