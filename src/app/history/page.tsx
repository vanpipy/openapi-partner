'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConfigHistory } from '@/lib/db';
import { ConfigHistoryList } from '@/components/config/ConfigHistory';

interface HistoryEntry extends ConfigHistory {
  configKey?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [configIdFilter, setConfigIdFilter] = useState<string>('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    // In a real implementation, this would call an API or Server Action
    // For now, we'll use mock data
    try {
      // Mock data for demonstration
      const mockHistory: HistoryEntry[] = [
        {
          id: 1,
          configId: 1,
          oldValue: JSON.stringify({ rate: 0.05 }),
          newValue: JSON.stringify({ rate: 0.06 }),
          changedAt: new Date(Date.now() - 3600000),
          changeReason: 'Updated interest rate',
        },
        {
          id: 2,
          configId: 2,
          oldValue: 'v1.0.0',
          newValue: 'v1.1.0',
          changedAt: new Date(Date.now() - 7200000),
          changeReason: 'Version bump',
        },
        {
          id: 3,
          configId: 1,
          oldValue: JSON.stringify({ rate: 0.04 }),
          newValue: JSON.stringify({ rate: 0.05 }),
          changedAt: new Date(Date.now() - 86400000),
          changeReason: 'Initial rate adjustment',
        },
      ];
      setHistory(mockHistory);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
    setLoading(false);
  };

  const filteredHistory = history.filter((record) => {
    if (configIdFilter && record.configId.toString() !== configIdFilter) {
      return false;
    }
    return true;
  });

  const handleViewConfig = (configId: number) => {
    router.push(`/?highlight=${configId}`);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">配置历史</h1>
              <p className="mt-1 text-sm text-gray-500">查看配置变更记录</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
            >
              ← 返回配置列表
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="configId" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Config ID
              </label>
              <input
                type="text"
                id="configId"
                value={configIdFilter}
                onChange={(e) => setConfigIdFilter(e.target.value)}
                placeholder="Enter config ID..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setConfigIdFilter('')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filter
              </button>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">
            Change History ({filteredHistory.length} records)
          </h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <ConfigHistoryList
              history={filteredHistory}
              onViewConfig={handleViewConfig}
            />
          )}
        </div>
      </div>
    </main>
  );
}
