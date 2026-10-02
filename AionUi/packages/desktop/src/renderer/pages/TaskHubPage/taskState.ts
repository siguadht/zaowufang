import type { TChatConversation } from '@/common/config/storage';

export type TaskState = 'waiting' | 'running' | 'idle';

/** A conversation's live runtime state, without claiming its product work is approved. */
export const getTaskState = (conversation: TChatConversation): TaskState => {
  if (
    conversation.runtime?.state === 'waiting_confirmation' ||
    (conversation.runtime?.pending_confirmations ?? 0) > 0
  ) {
    return 'waiting';
  }
  if (conversation.runtime?.is_processing || conversation.status === 'running' || conversation.status === 'pending') {
    return 'running';
  }
  return 'idle';
};

export const getTaskWorkspace = (conversation: TChatConversation): string | undefined => {
  const extra = conversation.extra as { workspace?: unknown };
  return typeof extra?.workspace === 'string' && extra.workspace.trim() ? extra.workspace : undefined;
};
