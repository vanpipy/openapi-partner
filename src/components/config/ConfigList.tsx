'use client';

import { useState } from 'react';
import { Config, Environment } from '@/lib/db';

interface ConfigListProps {
  configs: Config[];
  onEdit: (config: Config) => void;
  onDelete: (id: number) => void;
  currentEnvironment: Environment;
}

export function ConfigList({
  configs,
  onEdit,
  onDelete,
  currentEnvironment,
}: ConfigListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this config?')) {
      setDeletingId(id);
      await onDelete(id);
      setDeletingId(null);
    }
  };

  const formatValue = (config: Config) => {
    if (config.type === 'json') {
      try {
        return JSON.stringify(JSON.parse(config.value), null, 2);
      } catch {
        return config.value;
      }
    }
    return config.value;
  };

  if (configs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No configurations found in {currentEnvironment}.</p>
        <p className="text-sm mt-2">Create your first config to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Key
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Updated
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {configs.map((config) => (
            <tr key={config.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <code className="text-sm font-mono text-blue-600">{config.key}</code>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    config.type === 'string'
                      ? 'bg-green-100 text-green-800'
                      : config.type === 'number'
                      ? 'bg-blue-100 text-blue-800'
                      : config.type === 'boolean'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {config.type}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="max-w-xs truncate text-sm text-gray-900 font-mono">
                  {formatValue(config)}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="max-w-xs truncate text-sm text-gray-500">
                  {config.description || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {config.updatedAt
                  ? new Date(config.updatedAt).toLocaleDateString()
                  : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onEdit(config)}
                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={deletingId === config.id}
                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                >
                  {deletingId === config.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
