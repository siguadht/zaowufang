import type { AssistantDetail } from '@/common/types/agent/assistantTypes';
import type { IMcpServer } from '@/common/config/storage';
import { BLUEPRINT_MCP_NAME, PROJECT_WORKFLOW_MCP_NAME } from '@/common/config/constants';

/** Product Bot always takes the Blueprint MCP into each new conversation. */
export const withProductBlueprintMcp = (
  assistantId: string | null,
  selectedIds: string[],
  availableServers: IMcpServer[]
): string[] => {
  if (assistantId !== 'xuzuo-product') return selectedIds;
  const blueprint = availableServers.find((server) => server.name === BLUEPRINT_MCP_NAME && server.enabled);
  return blueprint ? [...new Set([...selectedIds, blueprint.id])] : selectedIds;
};

/** Product, Developer, and QA Bots share the same persisted project workflow. */
export const withBotRequiredMcps = (
  assistantId: string | null,
  selectedIds: string[],
  availableServers: IMcpServer[]
): string[] => {
  const withBlueprint = withProductBlueprintMcp(assistantId, selectedIds, availableServers);
  if (!['xuzuo-product', 'xuzuo-developer', 'xuzuo-qa'].includes(assistantId ?? '')) return withBlueprint;
  const workflow = availableServers.find((server) => server.name === PROJECT_WORKFLOW_MCP_NAME && server.enabled);
  return workflow ? [...new Set([...withBlueprint, workflow.id])] : withBlueprint;
};

export type ResolvedGuidAssistantDefaults = {
  modelId?: string;
  permissionMode?: string;
  thoughtLevel?: string;
  skillIds: string[];
  disabledBuiltinSkillIds: string[];
  mcpIds: string[];
};

export const resolveGuidAssistantDefaults = (
  detail: AssistantDetail | null | undefined
): ResolvedGuidAssistantDefaults => {
  if (!detail) {
    return {
      modelId: undefined,
      permissionMode: undefined,
      thoughtLevel: undefined,
      skillIds: [],
      disabledBuiltinSkillIds: [],
      mcpIds: [],
    };
  }

  const modelId =
    detail.defaults.model.mode === 'fixed'
      ? detail.defaults.model.value
      : detail.defaults.model.mode === 'auto'
        ? detail.preferences.last_model_id
        : undefined;

  const permissionMode =
    detail.defaults.permission.mode === 'fixed'
      ? detail.defaults.permission.value
      : detail.defaults.permission.mode === 'auto'
        ? detail.preferences.last_permission_value
        : undefined;

  const thoughtLevelDefault = detail.defaults.thought_level ?? { mode: 'auto' };
  const thoughtLevel =
    thoughtLevelDefault.mode === 'fixed'
      ? thoughtLevelDefault.value
      : thoughtLevelDefault.mode === 'auto'
        ? detail.preferences.last_thought_level_value
        : undefined;

  const skillIds =
    detail.defaults.skills.mode === 'fixed'
      ? (detail.defaults.skills.value ?? [])
      : detail.defaults.skills.mode === 'auto'
        ? (detail.preferences.last_skill_ids ?? [])
        : [];

  const disabledBuiltinSkillIds =
    detail.defaults.skills.mode === 'fixed'
      ? (detail.capabilities.default_disabled_builtin_skill_ids ?? [])
      : detail.defaults.skills.mode === 'auto'
        ? (detail.preferences.last_disabled_builtin_skill_ids ?? [])
        : [];

  const mcpIds =
    detail.defaults.mcps.mode === 'fixed'
      ? (detail.defaults.mcps.value ?? [])
      : detail.defaults.mcps.mode === 'auto'
        ? (detail.preferences.last_mcp_ids ?? [])
        : [];

  return {
    modelId: modelId || undefined,
    permissionMode: permissionMode || undefined,
    thoughtLevel: thoughtLevel || undefined,
    skillIds,
    disabledBuiltinSkillIds,
    mcpIds,
  };
};
