'use client';

import { ConfigHistory } from '@/lib/db';

interface ConfigHistoryProps {
  history: ConfigHistory[];
  onViewConfig?: (configId: number) => void;
}

export function ConfigHistoryList({ history, onViewConfig }: ConfigHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No change history found.</p>
      </div>
    );
  }

  const formatValue = (value: string | null) => {
    if (!value) return <span className="text-gray-400 italic">null</span>;
    try {
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
          {JSON.stringify(JSON.parse(value), null, 2)}
        </pre>
      );
    } catch {
      return <code className="text-sm">{value}</code>;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {history.map((record) => (
        <div
          key={record.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                #{record.id}
              </span>
              <span className="text-sm text-gray-400">
                {formatDate(record.changedAt)}
              </span>
            </div>
            {onViewConfig && (
              <button
                onClick={() => onViewConfig(record.configId)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                View Config
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Old Value
              </label>
              <div className="bg-red-50 border border-red-100 rounded p-2">
                {formatValue(record.oldValue)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                New Value
              </label>
              <div className="bg-green-50 border border-green-100 rounded p-2">
                {formatValue(record.newValue)}
              </div>
            </div>
          </div>

          {record.changeReason && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Change Reason
              </label>
              <p className="text-sm text-gray-700">{record.changeReason}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
