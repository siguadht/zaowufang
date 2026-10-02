/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@arco-design/web-react';
import { Plus } from '@icon-park/react';
import classNames from 'classnames';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import styles from '../Sider.module.css';

interface SiderToolbarProps {
  isMobile: boolean;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  onNewChat: () => void;
}

const SiderToolbar: React.FC<SiderToolbarProps> = ({ isMobile, collapsed, siderTooltipProps, onNewChat }) => {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <div className='shrink-0 flex flex-col items-center gap-2px w-full'>
        <Tooltip {...siderTooltipProps} content={t('guid.sidebarNewTask')} position='right'>
          <Button
            type='primary'
            className={classNames('w-full h-38px', styles.newChatTrigger, styles.newTaskButton)}
            onClick={onNewChat}
            aria-label={t('guid.sidebarNewTask')}
          >
            <Plus
              theme='outline'
              size='16'
              fill='currentColor'
              className={classNames('block leading-none', styles.newChatIcon)}
              style={{ lineHeight: 0 }}
            />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className='shrink-0 flex items-center'>
      <Tooltip {...siderTooltipProps} content={t('guid.sidebarNewTask')} position='right'>
        <Button
          type='primary'
          className={classNames(
            styles.newChatTrigger,
            styles.newTaskButton,
            'h-38px flex-1 group',
            isMobile && 'sider-action-btn-mobile'
          )}
          onClick={onNewChat}
        >
          <span className={styles.newTaskContent}>
            <span className={styles.newTaskIcon}>
              <Plus
                theme='outline'
                size='14'
                fill='currentColor'
                className={classNames('block leading-none', styles.newChatIcon)}
                style={{ lineHeight: 0 }}
              />
            </span>
            <span className='collapsed-hidden'>{t('guid.sidebarNewTask')}</span>
          </span>
        </Button>
      </Tooltip>
    </div>
  );
};

export default SiderToolbar;
