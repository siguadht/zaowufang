/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { migrateConfigStorage, migrateLegacyMcpConfigToDb, migrateProviders } from '@/common/config/configMigration';
import { httpRequest } from '@/common/adapter/httpBridge';
import { mcpService } from '@/common/adapter/ipcBridge';
import type { ImageGenerationModelSetting } from '@/common/config/clientSettings';
import { BLUEPRINT_MCP_NAME, BUILTIN_BROWSER_MCP_NAME, PROJECT_WORKFLOW_MCP_NAME } from '@/common/config/constants';
import { APP_DISPLAY_NAME } from '@/common/branding';
import {
  removeImageGenerationEnvKeys,
  resolveImageGenerationMcpEnv,
  type ImageGenerationMcpEnvResolveResult,
} from '@/common/config/imageGenerationMcpEnv';
import { BUILTIN_IMAGE_GEN_NAME, type IMcpServer, type IProvider } from '@/common/config/storage';
import { getBuiltinMcpScriptPath, type ProcessConfig as ProcessConfigType } from './initStorage';
import { migrateAssistantsToBackend } from './migrateAssistants';

type ConfigFile = typeof ProcessConfigType;
type MigrationStepResult = boolean;
type McpImportServer = Partial<IMcpServer> & Pick<IMcpServer, 'name' | 'transport'>;
type BackendClientPreferences = Record<string, unknown>;
const BUILTIN_CHROME_DEVTOOLS_NAME = 'chrome-devtools';

/**
 * 内置「应用内浏览器」MCP。
 *
 * 与 chrome-devtools 的区别：那个默认关闭，开启后会由 MCP 自己开一个独立 Chrome
 * 窗口 —— 用户在 APP 里看不见。这个默认开启，且强制连到 APP 自己的 CDP 端口，
 * Agent 的每一步操作都发生在用户能看到的侧边预览面板里。
 *
 * The built-in in-app browser MCP. Unlike `chrome-devtools` (default-disabled and
 * spawning its own separate Chrome window the user cannot see), this one is
 * enabled by default and pinned to the app's own CDP port, so every agent action
 * happens in the side preview panel where the user can watch it.
 */
const BUILTIN_BROWSER_SCRIPT = 'builtin-mcp-browser';

const LEGACY_BACKEND_CLIENT_PREFERENCE_KEYS = [
  'assistants',
  'migration.assistantEnabledFixed',
  'migration.coworkDefaultSkillsAdded',
  'migration.builtinDefaultSkillsAdded_v2',
  'migration.promptsI18nAdded',
  'migration.assistantsSplitCustom',
] as const;

async function cleanupLegacyClientPreferences(): Promise<void> {
  const payloadEntries = LEGACY_BACKEND_CLIENT_PREFERENCE_KEYS.map((key): [string, null] => [key, null]);
  const payload = Object.fromEntries(payloadEntries);
  await httpRequest<void>('PUT', '/api/settings/client', payload);
}

const CLEANUP_STEPS: Array<{
  name: string;
  run: () => Promise<void>;
}> = [{ name: 'cleanupLegacyClientPreferences', run: async () => cleanupLegacyClientPreferences() }];

async function fetchBackendClientPreferences(): Promise<BackendClientPreferences> {
  try {
    return (await httpRequest<BackendClientPreferences>('GET', '/api/settings/client')) || {};
  } catch {
    return {};
  }
}

async function fetchProviders(): Promise<IProvider[]> {
  try {
    return (await httpRequest<IProvider[]>('GET', '/api/providers')) || [];
  } catch (error) {
    console.warn('[Migration] MCP bootstrap could not load providers for image generation env resolution', error);
    return [];
  }
}

async function fetchProductModelId(): Promise<string | undefined> {
  try {
    const detail = await httpRequest<{ preferences?: { last_model_id?: string } }>(
      'GET',
      '/api/assistants/xuzuo-product'
    );
    return detail?.preferences?.last_model_id;
  } catch {
    return undefined;
  }
}

/** Reuse the Product Bot's last model when possible; otherwise use a configured chat model. */
export function resolveBlueprintProvider(
  providers: IProvider[],
  preferredModel?: string
): { provider: IProvider; model: string } | null {
  const usable = providers.filter((provider) =>
    Boolean(provider.api_key && provider.base_url && Array.isArray(provider.models) && provider.models.length)
  );
  const preferred = usable.find((provider) => preferredModel && provider.models.includes(preferredModel));
  const provider = preferred || usable[0];
  if (!provider) return null;
  return { provider, model: preferred ? preferredModel! : provider.models[0] };
}

function resolveBlueprintHome(): string | null {
  const entryDir = path.dirname(getBuiltinMcpScriptPath('builtin-mcp-blueprint'));
  const candidates = [
    path.resolve(entryDir, '../../../agent-blueprint'),
    path.resolve(entryDir, '../../resources/agent-blueprint'),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, 'run_plan.py'))) || null;
}

function buildBuiltinBlueprintServer(selection: ReturnType<typeof resolveBlueprintProvider>): McpImportServer {
  const home = resolveBlueprintHome();
  const python = home && path.join(home, 'python', 'bin', 'python3.12');
  const hasRuntime = Boolean(python && existsSync(python));
  const scriptPath = getBuiltinMcpScriptPath('builtin-mcp-blueprint');
  const env =
    selection && home && hasRuntime
      ? {
          AIONUI_BLUEPRINT_HOME: home,
          AIONUI_BLUEPRINT_PYTHON: python!,
          AIONUI_BLUEPRINT_BASE_URL: selection.provider.base_url,
          AIONUI_BLUEPRINT_API_KEY: selection.provider.api_key,
          AIONUI_BLUEPRINT_MODEL: selection.model,
        }
      : {};
  const serverConfig = { command: 'node', args: [scriptPath], env };
  return {
    name: BLUEPRINT_MCP_NAME,
    description: 'Generate an Agent Blueprint architecture plan from a product idea before writing a PRD.',
    enabled: Boolean(selection && hasRuntime),
    builtin: true,
    transport: { type: 'stdio', ...serverConfig },
    original_json: JSON.stringify({ mcpServers: { [BLUEPRINT_MCP_NAME]: serverConfig } }, null, 2),
  };
}

function buildProjectWorkflowServer(): McpImportServer {
  const serverConfig = { command: 'node', args: [getBuiltinMcpScriptPath('builtin-mcp-workflow')] };
  return {
    name: PROJECT_WORKFLOW_MCP_NAME,
    description: 'Persist confirmed PRD, development, and QA handoffs in a shared project workspace.',
    enabled: true,
    builtin: true,
    transport: { type: 'stdio', ...serverConfig },
    original_json: JSON.stringify({ mcpServers: { [PROJECT_WORKFLOW_MCP_NAME]: serverConfig } }, null, 2),
  };
}

export function resolveImageGenerationMigrationConfig(
  backendPrefs: BackendClientPreferences,
  fileConfig?: ImageGenerationModelSetting
): ImageGenerationModelSetting | undefined {
  const backendConfig = backendPrefs['tools.imageGenerationModel'];
  if (backendConfig && typeof backendConfig === 'object') {
    return backendConfig as ImageGenerationModelSetting;
  }
  return fileConfig;
}

function resolveImageGenerationMigrationConfigSource(
  backendPrefs: BackendClientPreferences,
  fileConfig?: ImageGenerationModelSetting
): 'backend' | 'file' | 'none' {
  const backendConfig = backendPrefs['tools.imageGenerationModel'];
  if (backendConfig && typeof backendConfig === 'object') {
    return 'backend';
  }
  return fileConfig ? 'file' : 'none';
}

function logImageGenerationEnvResolution(
  result: ImageGenerationMcpEnvResolveResult,
  context: 'bootstrap' | 'update'
): void {
  if (result.ok === true) {
    console.info(
      '[Migration] image MCP env resolved via %s during %s, provider id: %s, platform: %s, model: %s, api key present: %s',
      result.source,
      context,
      result.provider.id,
      result.provider.platform,
      result.model,
      result.provider.api_key ? 'yes' : 'no'
    );
    return;
  }

  console.warn(
    '[Migration] image MCP env resolution failed during %s, reason: %s, message: %s, candidates: %s',
    context,
    result.reason,
    result.message,
    result.candidates?.join(',') || 'none'
  );
}

function buildBuiltinImageGenerationServer(
  resolution: ImageGenerationMcpEnvResolveResult,
  config?: ImageGenerationModelSetting
): McpImportServer {
  const scriptPath = getBuiltinMcpScriptPath('builtin-mcp-image-gen');
  const env = resolution.ok ? resolution.env : {};
  const serverConfig = {
    command: 'node',
    args: [scriptPath],
    env,
  };

  return {
    name: BUILTIN_IMAGE_GEN_NAME,
    description: 'Built-in image generation tool powered by AI models. Configure the model in Settings > Tools.',
    enabled: config?.switch === true && resolution.ok,
    builtin: true,
    transport: {
      type: 'stdio',
      command: 'node',
      args: [scriptPath],
      env,
    },
    original_json: JSON.stringify({ mcpServers: { [BUILTIN_IMAGE_GEN_NAME]: serverConfig } }, null, 2),
  };
}

function areStringArraysEqual(left?: string[], right?: string[]): boolean {
  const leftValue = left || [];
  const rightValue = right || [];
  return leftValue.length === rightValue.length && leftValue.every((item, index) => item === rightValue[index]);
}

function areStringRecordsEqual(left?: Record<string, string>, right?: Record<string, string>): boolean {
  const leftValue = left || {};
  const rightValue = right || {};
  const leftKeys = Object.keys(leftValue).toSorted();
  const rightKeys = Object.keys(rightValue).toSorted();
  return areStringArraysEqual(leftKeys, rightKeys) && leftKeys.every((key) => leftValue[key] === rightValue[key]);
}

function isSameStdioTransport(left: IMcpServer['transport'], right: IMcpServer['transport']): boolean {
  return (
    left.type === 'stdio' &&
    right.type === 'stdio' &&
    left.command === right.command &&
    areStringArraysEqual(left.args, right.args) &&
    areStringRecordsEqual(left.env, right.env)
  );
}

function buildBuiltinBrowserServer(): McpImportServer {
  const scriptPath = getBuiltinMcpScriptPath(BUILTIN_BROWSER_SCRIPT);
  const serverConfig = {
    command: 'node',
    args: [scriptPath],
  };

  return {
    name: BUILTIN_BROWSER_MCP_NAME,
    description:
      `Control ${APP_DISPLAY_NAME}'s built-in browser (the side preview panel): open pages, click, type and read content. ` +
      'Sign-in state is shared across tabs and preserved between sessions.',
    // 默认开启：用户装好即可用，无需任何配置
    // Enabled by default: works out of the box with zero configuration.
    enabled: true,
    builtin: true,
    transport: {
      type: 'stdio',
      command: serverConfig.command,
      args: serverConfig.args,
    },
    original_json: JSON.stringify({ mcpServers: { [BUILTIN_BROWSER_MCP_NAME]: serverConfig } }, null, 2),
  };
}

function buildDefaultMcpServers(): McpImportServer[] {
  const chromeConfig = {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
  };

  return [
    {
      name: BUILTIN_CHROME_DEVTOOLS_NAME,
      description: 'Default MCP server: chrome-devtools',
      enabled: false,
      builtin: true,
      transport: {
        type: 'stdio',
        command: chromeConfig.command,
        args: chromeConfig.args,
      },
      original_json: JSON.stringify({ mcpServers: { [BUILTIN_CHROME_DEVTOOLS_NAME]: chromeConfig } }, null, 2),
    },
    buildBuiltinBrowserServer(),
  ];
}

async function isCommandAvailable(command: string): Promise<boolean> {
  return await new Promise((resolve) => {
    execFile(command, ['--version'], { timeout: 3000 }, (error) => {
      if (!error) {
        resolve(true);
        return;
      }

      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

async function ensureBuiltinChromeDevtoolsAvailability(server?: IMcpServer): Promise<void> {
  if (
    !server ||
    server.name !== BUILTIN_CHROME_DEVTOOLS_NAME ||
    server.transport.type !== 'stdio' ||
    server.transport.command !== 'npx'
  ) {
    return;
  }

  const hasNpx = await isCommandAvailable(server.transport.command);
  if (hasNpx) {
    return;
  }

  try {
    await mcpService.testMcpConnection.invoke(server);
  } catch (error) {
    console.warn('[Migration] chrome-devtools MCP preflight failed', error);
  }
}

function buildOriginalJsonFromTransport(server: Pick<IMcpServer, 'name' | 'description' | 'transport'>): string {
  const transport_config =
    server.transport.type === 'stdio'
      ? {
          command: server.transport.command,
          args: server.transport.args || [],
          env: server.transport.env || {},
        }
      : {
          type: server.transport.type,
          url: server.transport.url,
          ...(server.transport.headers ? { headers: server.transport.headers } : {}),
        };

  return JSON.stringify(
    {
      mcpServers: {
        [server.name]: {
          ...(server.description ? { description: server.description } : {}),
          ...transport_config,
        },
      },
    },
    null,
    2
  );
}

async function ensureBootstrapMcpServersInDb(configFile: ConfigFile): Promise<void> {
  const [backendPrefs, fileImageConfig, providers, productModelId] = await Promise.all([
    fetchBackendClientPreferences(),
    configFile.get('tools.imageGenerationModel').catch((): undefined => undefined),
    fetchProviders(),
    fetchProductModelId(),
  ]);
  const imageConfig = resolveImageGenerationMigrationConfig(backendPrefs, fileImageConfig);
  const imageConfigSource = resolveImageGenerationMigrationConfigSource(backendPrefs, fileImageConfig);
  const existing = await mcpService.listServers.invoke();
  const existingByName = new Map((existing ?? []).map((server) => [server.name, server]));
  const existingImageServer = existingByName.get(BUILTIN_IMAGE_GEN_NAME);
  const existingImageEnv =
    existingImageServer?.transport.type === 'stdio' ? existingImageServer.transport.env : undefined;
  const imageEnvResolution = resolveImageGenerationMcpEnv(imageConfig, providers, existingImageEnv);
  logImageGenerationEnvResolution(imageEnvResolution, 'bootstrap');
  const imageServer = buildBuiltinImageGenerationServer(imageEnvResolution, imageConfig);
  const blueprintServer = buildBuiltinBlueprintServer(resolveBlueprintProvider(providers, productModelId));
  const workflowServer = buildProjectWorkflowServer();
  const defaultServers = buildDefaultMcpServers();
  const missing = [...defaultServers, imageServer, blueprintServer, workflowServer].filter(
    (server) => !existingByName.has(server.name)
  );
  let imageServerUpdated = false;

  if (missing.length > 0) {
    await mcpService.batchImportServers.invoke({ servers: missing });
  }

  const existingChromeDevtools = existingByName.get(BUILTIN_CHROME_DEVTOOLS_NAME);
  if (
    existingChromeDevtools &&
    (existingChromeDevtools.builtin !== true ||
      !existingChromeDevtools.original_json ||
      existingChromeDevtools.original_json.trim() === '' ||
      existingChromeDevtools.original_json.trim() === '{}')
  ) {
    await mcpService.updateServer.invoke({
      id: existingChromeDevtools.id,
      data: {
        builtin: true,
        original_json: buildOriginalJsonFromTransport(existingChromeDevtools),
      },
    });
  }

  const refreshedServers = await mcpService.listServers.invoke();
  const chromeDevtoolsServer = refreshedServers.find((server) => server.name === BUILTIN_CHROME_DEVTOOLS_NAME);
  await ensureBuiltinChromeDevtoolsAvailability(chromeDevtoolsServer);

  if (
    imageEnvResolution.ok === true &&
    existingImageServer &&
    existingImageServer.transport.type === 'stdio' &&
    imageServer.transport.type === 'stdio'
  ) {
    const mergedEnv = {
      ...removeImageGenerationEnvKeys(existingImageServer.transport.env || {}),
      ...imageEnvResolution.env,
    };
    const updatedTransport = {
      ...imageServer.transport,
      env: mergedEnv,
    };
    const original_json = JSON.stringify(
      {
        mcpServers: {
          [BUILTIN_IMAGE_GEN_NAME]: {
            command: updatedTransport.command,
            args: updatedTransport.args || [],
            env: mergedEnv,
          },
        },
      },
      null,
      2
    );
    const imageTransportChanged = !isSameStdioTransport(existingImageServer.transport, updatedTransport);
    const imageOriginalJsonChanged = existingImageServer.original_json !== original_json;
    const imageServerChanged = imageTransportChanged || imageOriginalJsonChanged;
    console.info(
      '[Migration] image MCP bootstrap decision, server id: %s, transport changed: %s, json changed: %s, will update: %s',
      existingImageServer.id,
      imageTransportChanged ? 'yes' : 'no',
      imageOriginalJsonChanged ? 'yes' : 'no',
      imageServerChanged ? 'yes' : 'no'
    );
    if (imageServerChanged) {
      await mcpService.updateServer.invoke({
        id: existingImageServer.id,
        data: {
          transport: updatedTransport,
          original_json,
        },
      });
      imageServerUpdated = true;
    }
  } else if (existingImageServer && imageEnvResolution.ok === false) {
    console.warn(
      '[Migration] skipped image MCP env update because provider could not be resolved, server id: %s, reason: %s',
      existingImageServer.id,
      imageEnvResolution.reason
    );
  }

  /**
   * 修复浏览器 MCP 记录里过期的脚本绝对路径。
   *
   * 注册时把绝对路径写进了 transport.args，只在「首次插入」时写一次。应用被移动过
   * （用户把 .app 拖出 /Applications、Windows 重装到别的目录、开发时换 worktree）
   * 之后这条路径就失效了，而按名字判断「已注册」使它永远不会被重新插入 ——
   * 结果是浏览器工具永久失效且不会自愈。所以每次启动都对齐一次实际路径。
   *
   * Repair a stale absolute script path in the browser MCP record. The path is baked
   * into transport.args and only written on first insert, so once the app moves (user
   * drags the .app out of /Applications, a Windows reinstall to a different directory,
   * a developer switching worktrees) it goes stale — and because "already registered"
   * is decided by name, it is never re-inserted, leaving the browser tools broken with
   * no self-heal. Reconcile against the real path on every startup instead.
   */
  const existingBrowserServer = existing.find((server) => server.name === BUILTIN_BROWSER_MCP_NAME);
  let browserServerUpdated = false;
  if (existingBrowserServer) {
    const desiredBrowserServer = buildBuiltinBrowserServer();
    const browserTransportChanged = !isSameStdioTransport(
      existingBrowserServer.transport,
      desiredBrowserServer.transport
    );
    const browserJsonChanged = existingBrowserServer.original_json !== desiredBrowserServer.original_json;
    if (browserTransportChanged || browserJsonChanged) {
      console.info(
        '[Migration] browser MCP path drifted, server id: %s, transport changed: %s, json changed: %s',
        existingBrowserServer.id,
        browserTransportChanged ? 'yes' : 'no',
        browserJsonChanged ? 'yes' : 'no'
      );
      await mcpService.updateServer.invoke({
        id: existingBrowserServer.id,
        data: {
          transport: desiredBrowserServer.transport,
          original_json: desiredBrowserServer.original_json,
        },
      });
      browserServerUpdated = true;
    }
  }

  const existingBlueprintServer = existingByName.get(BLUEPRINT_MCP_NAME);
  if (existingBlueprintServer) {
    const transportChanged = !isSameStdioTransport(existingBlueprintServer.transport, blueprintServer.transport);
    if (transportChanged || existingBlueprintServer.original_json !== blueprintServer.original_json) {
      await mcpService.updateServer.invoke({
        id: existingBlueprintServer.id,
        data: {
          transport: blueprintServer.transport,
          original_json: blueprintServer.original_json,
        },
      });
    }
    if (existingBlueprintServer.enabled !== blueprintServer.enabled) {
      await mcpService.toggleServer.invoke({ id: existingBlueprintServer.id });
    }
  }
  const existingWorkflowServer = existingByName.get(PROJECT_WORKFLOW_MCP_NAME);
  if (existingWorkflowServer) {
    if (
      !isSameStdioTransport(existingWorkflowServer.transport, workflowServer.transport) ||
      existingWorkflowServer.original_json !== workflowServer.original_json
    ) {
      await mcpService.updateServer.invoke({
        id: existingWorkflowServer.id,
        data: { transport: workflowServer.transport, original_json: workflowServer.original_json },
      });
    }
    if (existingWorkflowServer.enabled !== true) {
      await mcpService.toggleServer.invoke({ id: existingWorkflowServer.id });
    }
  }
  console.info(
    '[Migration] Agent Blueprint MCP ready: %s, model configured: %s',
    blueprintServer.enabled ? 'yes' : 'no',
    productModelId ? 'yes' : 'no'
  );

  console.info(
    '[Migration] MCP bootstrap completed, imported %d missing defaults, updated image server: %s, updated browser server: %s, image config source: %s, image enabled: %s',
    missing.length,
    imageServerUpdated ? 'yes' : 'no',
    browserServerUpdated ? 'yes' : 'no',
    imageConfigSource,
    imageConfig?.switch === true ? 'yes' : 'no'
  );
}

const MIGRATION_STEPS: Array<{
  name: string;
  run: (configFile: ConfigFile) => Promise<MigrationStepResult>;
}> = [
  {
    name: 'migrateLegacyMcpConfigToDb',
    run: async (configFile) => (await migrateLegacyMcpConfigToDb(configFile), true),
  },
  { name: 'migrateConfigStorage', run: async (configFile) => (await migrateConfigStorage(configFile), true) },
  { name: 'migrateProviders', run: async (configFile) => (await migrateProviders(configFile), true) },
  {
    name: 'ensureBootstrapMcpServersInDb',
    run: async (configFile) => (await ensureBootstrapMcpServersInDb(configFile), true),
  },
  { name: 'migrateAssistantsToBackend', run: async (configFile) => migrateAssistantsToBackend(configFile) },
];

async function syncBuiltinMcpConfig(configFile: ConfigFile): Promise<void> {
  const localMcpConfig = ((await configFile.get('mcp.config').catch((): IMcpServer[] => [])) || []) as IMcpServer[];
  const localBuiltinServers = localMcpConfig.filter((server) => server?.builtin === true);

  if (localBuiltinServers.length === 0) {
    return;
  }

  const backendSettings = (await httpRequest<Record<string, unknown>>('GET', '/api/settings/client')) || {};
  const backendMcpConfig = Array.isArray(backendSettings['mcp.config'])
    ? (backendSettings['mcp.config'] as IMcpServer[])
    : [];

  const mergedMcpConfig = [...backendMcpConfig.filter((server) => server?.builtin !== true), ...localBuiltinServers];

  if (JSON.stringify(backendMcpConfig) === JSON.stringify(mergedMcpConfig)) {
    return;
  }

  await httpRequest<void>('PUT', '/api/settings/client', { 'mcp.config': mergedMcpConfig });
  console.info(
    '[AionUi] Synced builtin MCP config to backend settings (%d builtin servers)',
    localBuiltinServers.length
  );
}

export async function runBackendMigrations(configFile: ConfigFile): Promise<void> {
  await CLEANUP_STEPS.reduce<Promise<void>>(async (previous, step) => {
    await previous;
    const start = Date.now();
    try {
      await step.run();
      console.info(`[AionUi] Backend migration step completed: ${step.name} (${Date.now() - start}ms)`);
    } catch (error) {
      console.error(`[AionUi] Backend migration step failed: ${step.name} (${Date.now() - start}ms)`, error);
    }
  }, Promise.resolve());

  await MIGRATION_STEPS.reduce<Promise<void>>(async (previous, step) => {
    await previous;
    const start = Date.now();
    try {
      const completed = await step.run(configFile);
      const elapsed = Date.now() - start;
      if (!completed) {
        console.warn(`[AionUi] Backend migration step incomplete: ${step.name} (${elapsed}ms)`);
        return;
      }
      console.info(`[AionUi] Backend migration step completed: ${step.name} (${elapsed}ms)`);
    } catch (error) {
      const elapsed = Date.now() - start;
      console.error(`[AionUi] Backend migration step failed: ${step.name} (${elapsed}ms)`, error);
    }
  }, Promise.resolve());

  const syncStart = Date.now();
  try {
    await syncBuiltinMcpConfig(configFile);
    console.info(`[AionUi] Backend migration step completed: syncBuiltinMcpConfig (${Date.now() - syncStart}ms)`);
  } catch (error) {
    console.error(`[AionUi] Backend migration step failed: syncBuiltinMcpConfig (${Date.now() - syncStart}ms)`, error);
  }
}
