'use client';

import { useState, useEffect } from 'react';
import { Config, Environment } from '@/lib/db';
import { ConfigList } from '@/components/config/ConfigList';
import { ConfigForm } from '@/components/config/ConfigForm';
import {
  listConfigsAction,
  createConfigAction,
  updateConfigAction,
  deleteConfigAction,
} from '@/app/actions/config';
import { CreateConfigInput } from '@/lib/validation';

export default function Home() {
  const [environment, setEnvironment] = useState<Environment>(Environment.DEVELOPMENT);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, [environment]);

  const loadConfigs = async () => {
    setLoading(true);
    const result = await listConfigsAction({ environment });
    if (result.success) {
      setConfigs(result.data.configs);
    } else {
      showNotification('error', result.error);
    }
    setLoading(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreate = async (data: CreateConfigInput) => {
    setActionLoading(true);
    const result = await createConfigAction({ ...data, environment });
    if (result.success) {
      showNotification('success', 'Config created successfully');
      setShowForm(false);
      loadConfigs();
    } else {
      showNotification('error', result.error);
    }
    setActionLoading(false);
  };

  const handleUpdate = async (data: CreateConfigInput) => {
    if (!editingConfig) return;
    setActionLoading(true);
    const result = await updateConfigAction({ id: editingConfig.id, value: data.value });
    if (result.success) {
      showNotification('success', 'Config updated successfully');
      setEditingConfig(null);
      loadConfigs();
    } else {
      showNotification('error', result.error);
    }
    setActionLoading(false);
  };

  const handleDelete = async (id: number) => {
    const result = await deleteConfigAction(id);
    if (result.success) {
      showNotification('success', 'Config deleted successfully');
      loadConfigs();
    } else {
      showNotification('error', result.error);
    }
  };

  const handleEdit = (config: Config) => {
    setEditingConfig(config);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConfig(null);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">配置平台</h1>
          <p className="mt-1 text-sm text-gray-500">极速自定义配置管理</p>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Environment Switcher */}
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setEnvironment(Environment.DEVELOPMENT)}
              className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                environment === Environment.DEVELOPMENT
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300`}
            >
              Development
            </button>
            <button
              onClick={() => setEnvironment(Environment.PRODUCTION)}
              className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                environment === Environment.PRODUCTION
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 border-l-0`}
            >
              Production
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={() => setShowForm(true)}
            disabled={showForm || editingConfig !== null}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + New Config
          </button>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">Create New Config</h2>
            <ConfigForm
              onSubmit={handleCreate}
              onCancel={handleCancel}
              environment={environment}
              isLoading={actionLoading}
            />
          </div>
        )}

        {/* Edit Form */}
        {editingConfig && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">
              Edit Config: <code className="text-indigo-600">{editingConfig.key}</code>
            </h2>
            <ConfigForm
              config={editingConfig}
              onSubmit={handleUpdate}
              onCancel={handleCancel}
              environment={environment}
              isLoading={actionLoading}
            />
          </div>
        )}

        {/* Config List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <ConfigList
              configs={configs}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentEnvironment={environment}
            />
          )}
        </div>

        {/* Stats Footer */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          {configs.length} config{configs.length !== 1 ? 's' : ''} in {environment}
        </div>
      </div>
    </main>
  );
}
