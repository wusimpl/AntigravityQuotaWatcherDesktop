import React, { useState, useEffect } from 'react';

interface ResetTimerProps {
  resetTime: string;
}

/**
 * 格式化剩余时间
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '已重置';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const ResetTimer: React.FC<ResetTimerProps> = ({ resetTime }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const resetDate = new Date(resetTime);
      const now = new Date();
      const diff = resetDate.getTime() - now.getTime();
      setTimeRemaining(formatTimeRemaining(diff));
    };

    // 立即更新一次
    updateTimer();

    // 每秒更新
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [resetTime]);

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>下次重置: {timeRemaining}</span>
    </div>
  );
};

export default ResetTimer;
