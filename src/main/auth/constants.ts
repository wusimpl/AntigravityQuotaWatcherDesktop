/**
 * OAuth 认证常量配置
 * 复用自 antigravity-quota-watcher
 */

// Google Cloud Code OAuth 客户端凭据
export const GOOGLE_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
export const GOOGLE_CLIENT_SECRET = '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';

// OAuth 2.0 端点
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// OAuth 权限作用域
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
].join(' ');

// OAuth 回调服务器配置
export const CALLBACK_HOST = '127.0.0.1';
export const CALLBACK_PATH = '/callback';

// 超时配置 (毫秒)
export const AUTH_TIMEOUT_MS = 60000;  // 60 秒

// Token 存储键名
export const TOKEN_STORAGE_KEY = 'oauth-tokens';
export const ACCOUNTS_STORAGE_KEY = 'accounts';
