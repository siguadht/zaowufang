import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import { getTaskState, getTaskWorkspace } from '@/renderer/pages/TaskHubPage/taskState';

const conversation = (overrides: Partial<TChatConversation> = {}): TChatConversation =>
  ({
    id: 'task-1',
    name: 'Build an MVP',
    type: 'codex',
    created_at: 1,
    modified_at: 2,
    extra: { workspace: '/work/product' },
    ...overrides,
  }) as TChatConversation;

describe('task hub state', () => {
  it('shows a pending confirmation before the running state', () => {
    expect(
      getTaskState(
        conversation({
          status: 'running',
          runtime: { state: 'waiting_confirmation', pending_confirmations: 1 } as TChatConversation['runtime'],
        })
      )
    ).toBe('waiting');
  });

  it('treats missing runtime information as idle rather than claiming completion', () => {
    expect(getTaskState(conversation({ status: undefined, runtime: undefined }))).toBe('idle');
  });

  it('does not expose a non-string workspace as a file browsing path', () => {
    expect(getTaskWorkspace(conversation({ extra: { workspace: 123 } } as Partial<TChatConversation>))).toBeUndefined();
  });
});
