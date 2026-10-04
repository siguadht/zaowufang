/**
 * @license
 * Copyright 2026 Zaowufang contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type WorkflowStage = 'prd_confirmed' | 'development' | 'testing' | 'changes_requested' | 'accepted';

export type WorkflowState = {
  version: 1;
  stage: WorkflowStage;
  prd: { path: string; sha256: string; confirmed_at: string; confirmation: string };
  development?: { started_at: string; handoff_at?: string; files?: string[]; verification?: string };
  test?: { recorded_at: string; passed: boolean; evidence: string };
  updated_at: string;
};

const STATE_FILE = path.join('.zaowufang', 'project-workflow.json');

function workspaceRoot(workspaceDir: string): string {
  if (!path.isAbsolute(workspaceDir) || !existsSync(workspaceDir)) {
    throw new Error('请提供已存在的工作区绝对路径。');
  }
  const root = realpathSync(workspaceDir);
  if (!lstatSync(root).isDirectory()) throw new Error('工作区路径不是目录。');
  return root;
}

function existingFile(root: string, file: string): string {
  if (!file || path.isAbsolute(file)) throw new Error('文件必须填写工作区内的相对路径。');
  const resolved = path.resolve(root, file);
  if (!existsSync(resolved)) throw new Error(`文件不存在：${file}`);
  const real = realpathSync(resolved);
  if (!real.startsWith(`${root}${path.sep}`) || !lstatSync(real).isFile()) {
    throw new Error(`文件必须位于工作区内：${file}`);
  }
  return real;
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function statePath(root: string): string {
  return path.join(root, STATE_FILE);
}

function save(root: string, state: WorkflowState): WorkflowState {
  const file = statePath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { flag: 'w', mode: 0o600 });
  renameSync(temp, file);
  return state;
}

export function readWorkflow(workspaceDir: string): WorkflowState | null {
  const file = statePath(workspaceRoot(workspaceDir));
  if (!existsSync(file)) return null;
  const state = JSON.parse(readFileSync(file, 'utf8')) as WorkflowState;
  if (state.version !== 1 || !state.prd?.path || !state.stage) throw new Error('项目流程状态文件无效。');
  return state;
}

export function confirmPrd(workspaceDir: string, prdPath: string, confirmation: string): WorkflowState {
  const root = workspaceRoot(workspaceDir);
  if (confirmation.trim().length < 4) throw new Error('需要记录用户明确确认 PRD 的原话。');
  const prd = existingFile(root, prdPath);
  if (!/\.md$/i.test(prd)) throw new Error('请提供 Markdown 格式的 PRD 文件。');
  const previous = readWorkflow(root);
  if (previous && previous.stage !== 'changes_requested' && previous.stage !== 'prd_confirmed') {
    throw new Error('项目已进入开发或测试；请先处理当前阶段，不能覆盖已确认的 PRD。');
  }
  const now = new Date().toISOString();
  return save(root, {
    version: 1,
    stage: 'prd_confirmed',
    prd: { path: path.relative(root, prd), sha256: sha256(prd), confirmed_at: now, confirmation: confirmation.trim() },
    updated_at: now,
  });
}

export function startDevelopment(workspaceDir: string): WorkflowState {
  const root = workspaceRoot(workspaceDir);
  const state = readWorkflow(root);
  if (!state || (state.stage !== 'prd_confirmed' && state.stage !== 'changes_requested')) {
    throw new Error('PRD 尚未确认，或项目不在可开发阶段。');
  }
  if (sha256(existingFile(root, state.prd.path)) !== state.prd.sha256) {
    throw new Error('PRD 在确认后发生变化，请用户重新确认。');
  }
  const now = new Date().toISOString();
  return save(root, { ...state, stage: 'development', development: { started_at: now }, updated_at: now });
}

export function handoffToTest(workspaceDir: string, files: string[], verification: string): WorkflowState {
  const root = workspaceRoot(workspaceDir);
  const state = readWorkflow(root);
  if (!state || state.stage !== 'development') throw new Error('项目未处于开发阶段，不能交给测试。');
  if (!files.length) throw new Error('交接必须列出真实的代码或交付文件。');
  if (verification.trim().length < 12) throw new Error('交接必须写明实际运行的验证及结果。');
  const checkedFiles = [...new Set(files.map((file) => path.relative(root, existingFile(root, file))))];
  const now = new Date().toISOString();
  return save(root, {
    ...state,
    stage: 'testing',
    development: { ...state.development!, handoff_at: now, files: checkedFiles, verification: verification.trim() },
    updated_at: now,
  });
}

export function recordTest(workspaceDir: string, passed: boolean, evidence: string): WorkflowState {
  const root = workspaceRoot(workspaceDir);
  const state = readWorkflow(root);
  if (!state || state.stage !== 'testing') throw new Error('项目未处于测试阶段。');
  if (evidence.trim().length < 12) throw new Error('请记录实际测试的步骤与结果。');
  const now = new Date().toISOString();
  return save(root, {
    ...state,
    stage: passed ? 'accepted' : 'changes_requested',
    test: { recorded_at: now, passed, evidence: evidence.trim() },
    updated_at: now,
  });
}
