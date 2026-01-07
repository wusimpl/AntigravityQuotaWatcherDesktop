/**
 * 登录弹窗组件
 * 显示登录流程状态，支持手动复制授权链接
 */
import React, { useState, useEffect, useCallback } from 'react';

type LoginFlowState = 'idle' | 'preparing' | 'opening_browser' | 'waiting_auth' | 'exchanging_token' | 'success' | 'error' | 'cancelled';

interface LoginFlowInfo {
  state: LoginFlowState;
  authUrl?: string;
  error?: string;
}

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [flowInfo, setFlowInfo] = useState<LoginFlowInfo>({ state: 'idle' });
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // 监听登录流程状态
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = window.electronAPI?.onLoginFlowUpdate((info) => {
      setFlowInfo(info);
      
      if (info.state === 'success') {
        setTimeout(() => {
          onSuccess();
        }, 800);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isOpen, onSuccess]);

  // 开始登录
  const startLogin = useCallback(async () => {
    if (isStarting) return;
    
    setIsStarting(true);
    setCopied(false);
    setFlowInfo({ state: 'preparing' });
    
    try {
      await window.electronAPI?.login();
    } finally {
      setIsStarting(false);
    }
  }, [isStarting]);

  // 弹窗打开时自动开始登录
  useEffect(() => {
    if (isOpen && flowInfo.state === 'idle') {
      startLogin();
    }
  }, [isOpen, flowInfo.state, startLogin]);

  // 取消登录
  const handleCancel = useCallback(() => {
    window.electronAPI?.loginCancel();
    onClose();
  }, [onClose]);

  // 复制链接
  const handleCopyUrl = useCallback(async () => {
    if (!flowInfo.authUrl) return;
    
    try {
      await navigator.clipboard.writeText(flowInfo.authUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [flowInfo.authUrl]);

  // 重试
  const handleRetry = useCallback(() => {
    setFlowInfo({ state: 'idle' });
    startLogin();
  }, [startLogin]);

  if (!isOpen) return null;

  // 状态文案
  const getStatusText = () => {
    switch (flowInfo.state) {
      case 'preparing':
        return '正在准备登录...';
      case 'opening_browser':
        return '正在打开浏览器...';
      case 'waiting_auth':
        return '等待授权中...';
      case 'exchanging_token':
        return '正在完成登录...';
      case 'success':
        return '登录成功！';
      case 'error':
        return '登录失败';
      case 'cancelled':
        return '已取消';
      default:
        return '准备中...';
    }
  };

  // 是否显示链接区域
  const showUrlSection = flowInfo.authUrl && 
    ['opening_browser', 'waiting_auth', 'error'].includes(flowInfo.state);

  // 是否显示加载动画
  const showLoading = ['preparing', 'opening_browser', 'waiting_auth', 'exchanging_token'].includes(flowInfo.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden border border-gray-700">
        {/* 标题栏 */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center">
          <svg className="w-5 h-5 text-blue-400 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-white font-medium">Google 账户登录</span>
        </div>

        {/* 内容区 */}
        <div className="px-5 py-6">
          {/* 状态显示 */}
          <div className="flex items-center justify-center mb-5">
            {showLoading && flowInfo.state !== 'success' && (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
            )}
            {flowInfo.state === 'success' && (
              <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {flowInfo.state === 'error' && (
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-sm ${
              flowInfo.state === 'success' ? 'text-green-400' :
              flowInfo.state === 'error' ? 'text-red-400' :
              'text-gray-300'
            }`}>
              {getStatusText()}
            </span>
          </div>

          {/* 错误信息 */}
          {flowInfo.state === 'error' && flowInfo.error && (
            <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg">
              <p className="text-xs text-red-300 break-all">{flowInfo.error}</p>
            </div>
          )}

          {/* 链接区域 */}
          {showUrlSection && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>浏览器没有打开？请手动复制链接到浏览器中打开</span>
              </div>
              
              {/* 链接显示框 */}
              <div className="relative">
                <div className="px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-400 break-all max-h-20 overflow-y-auto select-all">
                  {flowInfo.authUrl}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopyUrl}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    copied 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制链接
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-4 border-t border-gray-700 flex justify-end gap-3">
          {flowInfo.state === 'error' && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors"
            >
              重试
            </button>
          )}
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {flowInfo.state === 'success' ? '关闭' : '取消'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginDialog;
