/**
 * @license
 * Copyright 2026 Zaowufang contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  confirmPrd,
  handoffToTest,
  readWorkflow,
  recordTest,
  startDevelopment,
} from '@/process/resources/builtinMcp/workflowStore';

const dirs: string[] = [];
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'zaowufang-workflow-'));
  dirs.push(dir);
  writeFileSync(path.join(dir, 'PRD.md'), '# Confirmed requirement\n');
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('project workflow persistence', () => {
  it('refuses development before a PRD was approved', () => {
    expect(() => startDevelopment(project())).toThrow('PRD 尚未确认');
  });

  it('refuses a changed PRD even after approval', () => {
    const dir = project();
    confirmPrd(dir, 'PRD.md', '我确认这份 PRD');
    writeFileSync(path.join(dir, 'PRD.md'), '# Changed after approval\n');
    expect(() => startDevelopment(dir)).toThrow('发生变化');
  });

  it('persists a real development and QA handoff across reads', () => {
    const dir = project();
    confirmPrd(dir, 'PRD.md', '我确认这份 PRD');
    startDevelopment(dir);
    writeFileSync(path.join(dir, 'app.ts'), 'export const ready = true;\n');
    handoffToTest(dir, ['app.ts'], 'bunx tsc --noEmit passed; runtime still needs QA.');
    expect(readWorkflow(dir)?.development?.files).toEqual(['app.ts']);
    expect(readWorkflow(dir)?.stage).toBe('testing');
    expect(readFileSync(path.join(dir, '.zaowufang', 'project-workflow.json'), 'utf8')).toContain('testing');
  });

  it('rejects handoff when implementation files do not exist', () => {
    const dir = project();
    confirmPrd(dir, 'PRD.md', '我确认这份 PRD');
    startDevelopment(dir);
    expect(() => handoffToTest(dir, ['missing.ts'], 'bun test passed for real code.')).toThrow('文件不存在');
  });

  it('returns a failed review to development', () => {
    const dir = project();
    confirmPrd(dir, 'PRD.md', '我确认这份 PRD');
    startDevelopment(dir);
    writeFileSync(path.join(dir, 'app.ts'), 'export const ready = true;\n');
    handoffToTest(dir, ['app.ts'], 'bunx tsc --noEmit passed for real code.');
    expect(recordTest(dir, false, 'App opens, but the save action fails.').stage).toBe('changes_requested');
    expect(startDevelopment(dir).stage).toBe('development');
  });

  it('rejects files outside the workspace', () => {
    const dir = project();
    expect(() => confirmPrd(dir, '../outside.md', '我确认这份 PRD')).toThrow('文件不存在');
  });
});
