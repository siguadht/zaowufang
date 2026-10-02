import { Button, Input, Spin } from '@arco-design/web-react';
import { ArrowLeft, FolderClose, ListCheckbox, Refresh, Right, Search } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ipcBridge } from '@/common';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import type { TChatConversation } from '@/common/config/storage';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import { useLocalFilePreview } from '@/renderer/pages/conversation/Preview/hooks/useLocalFilePreview';
import { getTaskState, getTaskWorkspace, type TaskState } from './taskState';
import styles from './TaskHubPage.module.css';

const taskTitle = (task: TChatConversation): string => task.name?.trim() || task.desc?.trim() || task.id;
const statusKeys = {
  waiting: 'guid.taskHubWaiting',
  running: 'guid.taskHubRunning',
  idle: 'guid.taskHubIdle',
} as const;
const filterKeys = { all: 'guid.taskHubAll', ...statusKeys } as const;

const TaskHubPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFilesPage = pathname === '/deliverables';
  const { conversations } = useConversationHistoryContext();
  const tasks = useMemo(
    () =>
      conversations
        .filter((item) => !(item.extra as { is_health_check?: boolean })?.is_health_check)
        .toSorted((a, b) => b.modified_at - a.modified_at),
    [conversations]
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TaskState>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [entries, setEntries] = useState<IDirOrFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const workspace = selectedTask ? getTaskWorkspace(selectedTask) : undefined;
  const openFilePreview = useLocalFilePreview(workspace);

  useEffect(() => {
    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) return;
    setSelectedTaskId(tasks.find((task) => getTaskWorkspace(task))?.id ?? tasks[0]?.id ?? null);
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    setFolderPath('');
    setEntries([]);
  }, [selectedTaskId]);

  useEffect(() => {
    if (!isFilesPage || !selectedTask || !workspace) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void ipcBridge.conversation.getWorkspace
      .invoke({ conversation_id: selectedTask.id, workspace, path: folderPath || workspace })
      .then((items) => {
        if (!cancelled)
          setEntries(items.toSorted((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folderPath, isFilesPage, reloadCount, selectedTask, workspace]);

  const visibleTasks = tasks.filter((task) => {
    const matchesQuery = `${taskTitle(task)} ${getTaskWorkspace(task) ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (filter === 'all' || getTaskState(task) === filter);
  });

  const statusText = (task: TChatConversation): string => t(statusKeys[getTaskState(task)]);

  const formatTime = (timestamp: number): string =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));

  const openTask = (task: TChatConversation): void => {
    void navigate(`/conversation/${task.id}`);
  };

  const goBack = (): void => {
    if (!workspace || folderPath === workspace) return;
    const parent = folderPath.slice(0, folderPath.lastIndexOf('/'));
    setFolderPath(parent.length < workspace.length ? workspace : parent);
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t('guid.taskHubEyebrow')}</span>
          <h1>{t(isFilesPage ? 'guid.deliverablesTitle' : 'guid.taskHubTitle')}</h1>
          <p>{t(isFilesPage ? 'guid.deliverablesSubtitle' : 'guid.taskHubSubtitle')}</p>
        </header>

        {isFilesPage ? (
          <div className={styles.filesLayout}>
            <section className={styles.taskRail} aria-label={t('guid.deliverablesSelectTask')}>
              <div className={styles.panelHeading}>{t('guid.deliverablesSelectTask')}</div>
              {tasks.map((task) => (
                <Button
                  key={task.id}
                  type='text'
                  className={classNames(styles.railTask, selectedTaskId === task.id && styles.selectedRailTask)}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <span className={styles.railTaskName}>{taskTitle(task)}</span>
                  <span className={styles.railTaskMeta}>{formatTime(task.modified_at)}</span>
                </Button>
              ))}
            </section>
            <section className={styles.filePanel} aria-label={t('guid.deliverablesWorkspaceFiles')}>
              <div className={styles.filePanelTop}>
                <div>
                  <div className={styles.panelHeading}>{t('guid.deliverablesWorkspaceFiles')}</div>
                  <div className={styles.pathText}>{folderPath || workspace || '—'}</div>
                </div>
                <Button
                  type='text'
                  icon={<Refresh size={16} />}
                  aria-label={t('guid.deliverablesRefresh')}
                  onClick={() => setReloadCount((value) => value + 1)}
                />
              </div>
              {selectedTask && workspace && folderPath && folderPath !== workspace && (
                <Button type='text' className={styles.backButton} icon={<ArrowLeft size={16} />} onClick={goBack}>
                  {t('guid.deliverablesBack')}
                </Button>
              )}
              {!tasks.length && <div className={styles.emptyState}>{t('guid.taskHubEmpty')}</div>}
              {selectedTask && !workspace && (
                <div className={styles.emptyState}>{t('guid.deliverablesNoWorkspace')}</div>
              )}
              {workspace && loading && (
                <div className={styles.emptyState}>
                  <Spin />
                </div>
              )}
              {workspace && !loading && loadError && (
                <div className={styles.emptyState}>{t('guid.deliverablesLoadError')}</div>
              )}
              {workspace && !loading && !loadError && entries.length === 0 && (
                <div className={styles.emptyState}>{t('guid.deliverablesEmpty')}</div>
              )}
              {workspace &&
                !loading &&
                !loadError &&
                entries.map((item) => (
                  <Button
                    key={item.fullPath}
                    type='text'
                    className={styles.fileRow}
                    icon={item.isDir ? <FolderClose size={17} /> : <ListCheckbox size={17} />}
                    onClick={() => (item.isDir ? setFolderPath(item.fullPath) : void openFilePreview(item.fullPath))}
                  >
                    <span>{item.name}</span>
                    {item.isDir && <Right size={15} />}
                  </Button>
                ))}
              {workspace && !loading && !loadError && entries.length > 0 && (
                <p className={styles.fileHint}>{t('guid.deliverablesFileHint')}</p>
              )}
              {selectedTask && (
                <Button type='text' className={styles.openTaskButton} onClick={() => openTask(selectedTask)}>
                  {t('guid.deliverablesOpenTask')} <Right size={15} />
                </Button>
              )}
            </section>
          </div>
        ) : (
          <>
            <div className={styles.taskToolbar}>
              <Input
                allowClear
                prefix={<Search size={16} />}
                className={styles.searchInput}
                placeholder={t('guid.taskHubSearch')}
                value={query}
                onChange={setQuery}
              />
              <div className={styles.filters}>
                {(['all', 'running', 'waiting', 'idle'] as const).map((key) => (
                  <Button
                    key={key}
                    type={filter === key ? 'primary' : 'text'}
                    className={styles.filterButton}
                    onClick={() => setFilter(key)}
                  >
                    {t(filterKeys[key])}
                  </Button>
                ))}
              </div>
            </div>
            <div className={styles.taskList}>
              {visibleTasks.length === 0 && <div className={styles.emptyState}>{t('guid.taskHubEmpty')}</div>}
              {visibleTasks.map((task) => (
                <Button key={task.id} type='text' className={styles.taskRow} onClick={() => openTask(task)}>
                  <span className={styles.taskGlyph}>
                    <ListCheckbox size={18} />
                  </span>
                  <span className={styles.taskBody}>
                    <span className={styles.taskName}>{taskTitle(task)}</span>
                    <span className={styles.taskMeta}>{getTaskWorkspace(task) || formatTime(task.modified_at)}</span>
                  </span>
                  <span className={classNames(styles.status, styles[getTaskState(task)])}>{statusText(task)}</span>
                  <Right size={16} />
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default TaskHubPage;
