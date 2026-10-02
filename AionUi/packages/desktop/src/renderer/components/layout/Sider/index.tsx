import classNames from 'classnames';
import { Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { Experiment, DashboardOne, FolderClose, ListCheckbox } from '@icon-park/react';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips, getSiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import { SiderToolbar, SiderSearchEntry, SiderScheduledEntry, SiderAssistantEntry } from './SiderNav';
import SiderFooter from './SiderFooter';
import TeamSiderSection from './TeamSiderSection';
import siderStyles from './Sider.module.css';
import { useAssistantList } from '@/renderer/hooks/assistant/useAssistantList';
import { resolveAssistantAvatar } from '@/renderer/utils/model/assistantAvatar';
import ThemedLogo from '@/renderer/components/agent/ThemedLogo';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname, search, hash } = location;

  const navigate = useNavigate();
  const { closePreview, clearPreviewForScope } = usePreviewContext();
  const { logout, status } = useAuth();
  const { theme, setTheme } = useThemeContext();
  const { assistants, localeKey } = useAssistantList();
  const { conversations } = useConversationHistoryContext();
  const botIds = ['xuzuo-product', 'xuzuo-developer', 'xuzuo-qa', 'xuzuo-office'];
  const botAssistants = botIds
    .map((id) => assistants.find((assistant) => assistant.id === id && assistant.enabled !== false))
    .filter((assistant): assistant is NonNullable<typeof assistant> => Boolean(assistant));
  const [isBatchMode, setIsBatchMode] = useState(false);
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPathRef = useRef('/guid');
  const showLogout =
    typeof window !== 'undefined' && !(window as { electronAPI?: unknown }).electronAPI && status === 'authenticated';

  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      lastNonSettingsPathRef.current = `${pathname}${search}${hash}`;
    }
  }, [pathname, search, hash]);

  const handleNewChat = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid', { state: { resetAssistant: true } })).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleSettingsClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    if (isSettings) {
      const target = lastNonSettingsPathRef.current || '/guid';
      Promise.resolve(navigate(target)).catch((error) => {
        console.error('Navigation failed:', error);
      });
    } else {
      Promise.resolve(navigate('/settings/agent')).catch((error) => {
        console.error('Navigation failed:', error);
      });
    }
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleConversationSelect = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    // Do NOT call closePreview() here. conversation/index.tsx calls
    // closePreviewIfScopeChanged() once the conversation data loads, which
    // keeps the preview open when switching between conversations of the same
    // scope and closes it only when the scope (today = workspace) actually changes.
    setIsBatchMode(false);
  };

  const handleScheduledClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/scheduled')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleAssistantClick = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/assistants')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handleQuickThemeToggle = () => {
    void setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = useCallback(async () => {
    cleanupSiderTooltips();
    blurActiveElement();
    // Hide the panel now so the UI responds immediately; the tabs themselves are
    // discarded after logout resolves, below.
    closePreview();
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      return; // logout 失败时不执行后续操作
    }
    // Discard this account's tabs from memory.
    //
    // `clearAuthCache` (inside logout) already deletes the stored `preview-ui:`
    // keys, but PreviewProvider is mounted at the app root and does not unmount on
    // logout, so its state survives. The persist effect depends on [tabs,
    // activeTabId, isOpen] and is still live — so the next change of any of those
    // would write this account's tabs straight back to disk, undoing the very
    // cleanup that ran moments earlier and showing them to whoever logs in next.
    //
    // Done after `await logout()` rather than before: discarding first would throw
    // the tabs away even on a path that left the user signed in. `logout()` handles
    // its own request failure and clears auth in a `finally`, so reaching this line
    // means the account really is signed out.
    clearPreviewForScope();
    if (onSessionClick) {
      onSessionClick();
    }
  }, [closePreview, clearPreviewForScope, logout, onSessionClick]);

  useEffect(() => {
    if (!showLogout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLogout, showLogout]);

  const tooltipEnabled = collapsed && !isMobile;
  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);

  const workspaceHistoryProps = {
    collapsed,
    tooltipEnabled,
    onSessionClick,
    batchMode: isBatchMode,
    onBatchModeChange: setIsBatchMode,
  };

  return (
    <div className='size-full flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled} />
          </Suspense>
        ) : (
          <div className='size-full flex flex-col gap-2px'>
            <SiderToolbar
              isMobile={isMobile}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onNewChat={handleNewChat}
            />
            <Button
              type={pathname === '/guid' ? 'secondary' : 'text'}
              className={siderStyles.workbenchEntry}
              icon={<DashboardOne size={18} />}
              onClick={() => {
                closePreview();
                setIsBatchMode(false);
                void navigate('/guid');
                onSessionClick?.();
              }}
            >
              {!collapsed && t('guid.sidebarWorkbench')}
            </Button>
            <Button
              type={pathname === '/tasks' ? 'secondary' : 'text'}
              className={siderStyles.workbenchEntry}
              icon={<ListCheckbox size={18} />}
              onClick={() => {
                closePreview();
                setIsBatchMode(false);
                void navigate('/tasks');
                onSessionClick?.();
              }}
            >
              {!collapsed && t('guid.sidebarTaskList')}
            </Button>
            <Button
              type={pathname === '/deliverables' ? 'secondary' : 'text'}
              className={siderStyles.workbenchEntry}
              icon={<FolderClose size={18} />}
              onClick={() => {
                closePreview();
                setIsBatchMode(false);
                void navigate('/deliverables');
                onSessionClick?.();
              }}
            >
              {!collapsed && t('guid.sidebarDeliverables')}
            </Button>
            {botAssistants.length > 0 && (
              <div className={siderStyles.botTeamNav}>
                {!collapsed && <div className={siderStyles.botTeamHeading}>{t('guid.botTeamTitle')}</div>}
                {botAssistants.map((assistant) => {
                  const avatar = resolveAssistantAvatar(assistant.avatar);
                  return (
                    <Button
                      key={assistant.id}
                      type='text'
                      className={siderStyles.botTeamEntry}
                      aria-label={assistant.name_i18n?.[localeKey] || assistant.name}
                      onClick={() => {
                        closePreview();
                        setIsBatchMode(false);
                        void navigate('/guid', { state: { selectedAssistantId: assistant.id } });
                        onSessionClick?.();
                      }}
                    >
                      <span className={siderStyles.botTeamAvatar}>
                        {avatar.kind === 'image' && <ThemedLogo src={avatar.value} alt='' />}
                      </span>
                      {!collapsed && <span>{assistant.name_i18n?.[localeKey] || assistant.name}</span>}
                    </Button>
                  );
                })}
              </div>
            )}
            {!collapsed && <div className={siderStyles.toolsHeading}>{t('guid.sidebarTools')}</div>}
            {/* Search entry — desktop moves this into the titlebar toolbar;
                mobile keeps it here in the sidebar. */}
            {isMobile && (
              <SiderSearchEntry
                isMobile={isMobile}
                collapsed={collapsed}
                siderTooltipProps={siderTooltipProps}
                onConversationSelect={handleConversationSelect}
                onSessionClick={onSessionClick}
              />
            )}
            {/* Assistant nav entry - fixed above Scheduled */}
            <SiderAssistantEntry
              isMobile={isMobile}
              isActive={pathname.startsWith('/assistants')}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleAssistantClick}
            />
            {/* Scheduled tasks nav entry - fixed above scroll */}
            <Button
              type={pathname === '/model-bench' ? 'secondary' : 'text'}
              className={siderStyles.workbenchEntry}
              aria-label={t('common.modelBench.title')}
              title={t('common.modelBench.title')}
              icon={<Experiment size={18} />}
              onClick={() => {
                cleanupSiderTooltips();
                blurActiveElement();
                closePreview();
                setIsBatchMode(false);
                void navigate('/model-bench');
                onSessionClick?.();
              }}
            >
              {!collapsed && t('common.modelBench.title')}
            </Button>
            <SiderScheduledEntry
              isMobile={isMobile}
              isActive={pathname === '/scheduled'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={handleScheduledClick}
            />
            {/* Divider between fixed top nav and scrollable content area */}
            <div
              className={classNames(
                'shrink-0 mt-6px mb-2px h-1px bg-[var(--color-border-2)]',
                collapsed ? 'mx-6px' : 'mx-10px'
              )}
            />
            {/* Collaboration teams stay separate from the recent conversation history. */}
            <div className={classNames('flex-1 min-h-0 overflow-y-auto', siderStyles.scrollArea)}>
              <TeamSiderSection
                collapsed={collapsed}
                pathname={pathname}
                siderTooltipProps={siderTooltipProps}
                onSessionClick={onSessionClick}
              />
              {!collapsed && (
                <div className={siderStyles.recentTasksHeading}>
                  <span>{t('guid.sidebarRecentTasks')}</span>
                  {conversations.length > 0 && (
                    <button
                      type='button'
                      className={siderStyles.batchManageButton}
                      onClick={() => setIsBatchMode((prev) => !prev)}
                    >
                      {t(isBatchMode ? 'conversation.history.batchModeExit' : 'conversation.history.batchManage')}
                    </button>
                  )}
                </div>
              )}
              <Suspense fallback={<div className='min-h-200px' />}>
                <WorkspaceGroupedHistory {...workspaceHistoryProps} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
      {/* Footer */}
      <SiderFooter
        isMobile={isMobile}
        isSettings={isSettings}
        collapsed={collapsed}
        theme={theme}
        siderTooltipProps={siderTooltipProps}
        onSettingsClick={handleSettingsClick}
        onThemeToggle={handleQuickThemeToggle}
        showLogout={showLogout}
        onLogoutClick={handleLogout}
      />
    </div>
  );
};

export default Sider;
