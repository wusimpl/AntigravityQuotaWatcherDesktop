/**
 * 代理工具模块
 * 检测系统代理并创建代理 Agent
 */
import { session } from 'electron';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 从环境变量获取代理 URL
 * 优先级: HTTPS_PROXY > https_proxy > HTTP_PROXY > http_proxy > ALL_PROXY > all_proxy
 */
export function getProxyFromEnv(): string | null {
  const envVars = [
    'HTTPS_PROXY',
    'https_proxy',
    'HTTP_PROXY',
    'http_proxy',
    'ALL_PROXY',
    'all_proxy',
  ];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

/**
 * 使用 Electron 的 resolveProxy 获取系统代理
 * 这会自动处理 PAC 脚本和 WPAD
 */
export async function getProxyFromElectron(targetUrl: string): Promise<string | null> {
  try {
    // 确保 session 已初始化
    if (!session.defaultSession) {
      return null;
    }

    const proxyString = await session.defaultSession.resolveProxy(targetUrl);
    
    // proxyString 格式: "PROXY host:port; DIRECT" 或 "DIRECT"
    if (!proxyString || proxyString === 'DIRECT') {
      return null;
    }

    // 解析第一个代理
    const parts = proxyString.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('PROXY ')) {
        const hostPort = trimmed.replace('PROXY ', '').trim();
        return `http://${hostPort}`;
      }
      if (trimmed.startsWith('HTTPS ')) {
        const hostPort = trimmed.replace('HTTPS ', '').trim();
        return `https://${hostPort}`;
      }
    }

    return null;
  } catch (error) {
    console.error('[ProxyUtils] Failed to resolve proxy from Electron:', error);
    return null;
  }
}

/**
 * 获取系统代理 URL
 * 优先使用环境变量，然后使用 Electron resolveProxy
 */
export async function getSystemProxy(targetUrl?: string): Promise<string | null> {
  // 1. 先检查环境变量
  const envProxy = getProxyFromEnv();
  if (envProxy) {
    return envProxy;
  }

  // 2. 使用 Electron resolveProxy
  if (targetUrl) {
    const electronProxy = await getProxyFromElectron(targetUrl);
    if (electronProxy) {
      return electronProxy;
    }
  }

  return null;
}

/**
 * 创建代理 Agent
 * @param proxyUrl 代理 URL，如 "http://127.0.0.1:7890"
 * @returns HTTPS Proxy Agent 或 undefined（如果没有代理）
 */
export function createProxyAgent(proxyUrl: string | null | undefined): HttpsProxyAgent<string> | undefined {
  if (!proxyUrl || !proxyUrl.trim()) {
    return undefined;
  }

  try {
    return new HttpsProxyAgent(proxyUrl.trim());
  } catch (error) {
    console.error('[ProxyUtils] Failed to create proxy agent:', error);
    return undefined;
  }
}

/**
 * 获取有效的代理 URL
 * 如果用户设置了代理则使用用户设置，否则使用系统代理
 * @param userProxyUrl 用户设置的代理 URL
 * @param targetUrl 目标 URL（用于 Electron resolveProxy）
 */
export async function getEffectiveProxyUrl(
  userProxyUrl: string | undefined,
  targetUrl?: string
): Promise<string | null> {
  // 用户明确设置了代理
  if (userProxyUrl && userProxyUrl.trim()) {
    return userProxyUrl.trim();
  }

  // 使用系统代理
  return getSystemProxy(targetUrl);
}
