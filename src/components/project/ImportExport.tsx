'use client';

import { useState, useRef } from 'react';
import { Environment } from '@/lib/db';

interface ImportExportProps {
  onImportComplete?: () => void;
}

export function ImportExport({ onImportComplete }: ImportExportProps) {
  const [mode, setMode] = useState<'idle' | 'export' | 'import'>('idle');
  const [environment, setEnvironment] = useState<Environment | 'all'>('all');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // In production, this would call the Server Action
      // For now, we'll create a mock export
      const mockData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        environment,
        configs: [],
      };

      const content = JSON.stringify(mockData, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const env = environment === 'all' ? 'all' : environment;
      const filename = `configs-${env}-${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Exported to ${filename}` });
      setMode('idle');
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const content = await importFile.text();
      const data = JSON.parse(content);

      // Validate import data
      if (!data.configs || !Array.isArray(data.configs)) {
        throw new Error('Invalid file format');
      }

      // In production, this would call the Server Action
      // For now, we'll just show success
      const imported = data.configs.length;
      
      setMessage({ 
        type: 'success', 
        text: `Successfully imported ${imported} configs` 
      });
      
      setMode('idle');
      setImportFile(null);
      onImportComplete?.();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Import failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'idle') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setMode('export')}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
        >
          Export
        </button>
        <button
          onClick={() => setMode('import')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          Import
        </button>
      </div>
    );
  }

  if (mode === 'export') {
    return (
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Export Configs</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Environment
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as Environment | 'all')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">All Environments</option>
            <option value={Environment.DEVELOPMENT}>Development</option>
            <option value={Environment.PRODUCTION}>Production</option>
          </select>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Exporting...' : 'Download'}
          </button>
          <button
            onClick={() => {
              setMode('idle');
              setMessage(null);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'import') {
    return (
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">Import Configs</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select JSON File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            File should be in JSON format with a configs array
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={loading || !importFile}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={() => {
              setMode('idle');
              setMessage(null);
              setImportFile(null);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
