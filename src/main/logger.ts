/**
 * 简单的日志工具，带本地时间前缀
 */

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

export const logger = {
  log: (...args: unknown[]) => {
    console.log(`[${getTimestamp()}]`, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(`[${getTimestamp()}]`, ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(`[${getTimestamp()}]`, ...args);
  },
};
