import React from 'react';
import QuotaRing from './QuotaRing';
import type { ModelQuotaInfo } from '../../shared/types';

interface QuotaGridProps {
  models: ModelQuotaInfo[];
  warningThreshold?: number;
  criticalThreshold?: number;
}

const QuotaGrid: React.FC<QuotaGridProps> = ({
  models,
  warningThreshold = 50,
  criticalThreshold = 30,
}) => {
  if (models.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        暂无配额数据
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 justify-items-center">
      {models.map((model) => (
        <QuotaRing
          key={model.modelId}
          percentage={model.remainingPercentage}
          label={model.alias || model.displayName}
          warningThreshold={warningThreshold}
          criticalThreshold={criticalThreshold}
        />
      ))}
    </div>
  );
};

export default QuotaGrid;
