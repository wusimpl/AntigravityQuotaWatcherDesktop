import React from 'react';
import { useI18nContext } from '../i18n/I18nContext';
import AccountSelector from './AccountSelector';

interface AccountInfo {
  id: string;
  email: string;
}

interface TitleBarProps {
  accounts: AccountInfo[];
  activeAccount: AccountInfo | null;
  onAccountChange: (accountId: string) => void;
  onAddAccount: () => void;
  onSettingsClick?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ 
  accounts,
  activeAccount,
  onAccountChange,
  onAddAccount,
  onSettingsClick 
}) => {
  const { t } = useI18nContext();

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  return (
    <div className="drag-region flex items-center justify-between px-3 py-2 bg-gray-800/80 border-b border-gray-700">
      {/* 账户选择下拉框 */}
      <AccountSelector
        accounts={accounts}
        activeAccount={activeAccount}
        onAccountChange={onAccountChange}
        onAddAccount={onAddAccount}
      />

      {/* 右侧按钮 */}
      <div className="no-drag flex items-center gap-1">
        {/* 设置按钮 */}
        <button
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          onClick={onSettingsClick}
          title={t.common.settings}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* 最小化按钮 */}
        <button
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          onClick={handleMinimize}
          title={t.common.minimize}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* 关闭按钮 */}
        <button
          className="p-1.5 text-gray-400 hover:text-white hover:bg-red-600 rounded transition-colors"
          onClick={handleClose}
          title={t.common.close}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
