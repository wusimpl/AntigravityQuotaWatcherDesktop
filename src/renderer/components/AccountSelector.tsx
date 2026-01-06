import React, { useState, useRef, useEffect } from 'react';

interface AccountInfo {
  id: string;
  email: string;
}

interface AccountSelectorProps {
  accounts: AccountInfo[];
  activeAccount: AccountInfo | null;
  onAccountChange: (accountId: string) => void;
  onAddAccount: () => void;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  activeAccount,
  onAccountChange,
  onAddAccount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayText = activeAccount?.email || '未登录';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        className="no-drag flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate max-w-[180px]">{displayText}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* 账户列表 */}
          {accounts.length > 0 ? (
            <div className="py-1">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors ${
                    account.id === activeAccount?.id ? 'text-blue-400' : 'text-gray-300'
                  }`}
                  onClick={() => {
                    onAccountChange(account.id);
                    setIsOpen(false);
                  }}
                >
                  {/* 选中标记 */}
                  {account.id === activeAccount?.id ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="truncate">{account.email}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              暂无账户
            </div>
          )}

          {/* 分隔线 */}
          <div className="border-t border-gray-700" />

          {/* 添加账户按钮 */}
          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
            onClick={() => {
              onAddAccount();
              setIsOpen(false);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>添加账户</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountSelector;
