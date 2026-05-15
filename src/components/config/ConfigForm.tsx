'use client';

import { useState, useEffect } from 'react';
import { Config, ConfigType, Environment } from '@/lib/db';
import { CreateConfigInput } from '@/lib/validation';

interface ConfigFormProps {
  config?: Config | null;
  onSubmit: (data: CreateConfigInput) => Promise<void>;
  onCancel: () => void;
  environment: Environment;
  isLoading?: boolean;
}

export function ConfigForm({
  config,
  onSubmit,
  onCancel,
  environment,
  isLoading = false,
}: ConfigFormProps) {
  const [formData, setFormData] = useState<CreateConfigInput>({
    key: '',
    value: '',
    type: ConfigType.STRING,
    environment,
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        key: config.key,
        value: config.value,
        type: config.type as ConfigType,
        environment: config.environment as Environment,
        description: config.description || '',
      });
    } else {
      setFormData((prev) => ({ ...prev, environment }));
    }
  }, [config, environment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    // Validate key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.key)) {
      setValidationError('Key must start with a letter or underscore, and contain only alphanumeric characters and underscores');
      return;
    }

    // Validate value based on type
    if (formData.type === ConfigType.NUMBER && isNaN(Number(formData.value))) {
      setValidationError('Value must be a valid number');
      return;
    }

    if (formData.type === ConfigType.BOOLEAN && !['true', 'false', '1', '0'].includes(formData.value.toLowerCase())) {
      setValidationError('Value must be a boolean (true/false)');
      return;
    }

    if (formData.type === ConfigType.JSON) {
      try {
        JSON.parse(formData.value);
      } catch {
        setValidationError('Value must be valid JSON');
        return;
      }
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'key' || name === 'type') {
      setValidationError(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="key" className="block text-sm font-medium text-gray-700">
          Config Key <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="key"
          name="key"
          value={formData.key}
          onChange={handleChange}
          disabled={!!config || isLoading}
          placeholder="MY_CONFIG_KEY"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use UPPER_SNAKE_CASE for naming
        </p>
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Type <span className="text-red-500">*</span>
        </label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          disabled={!!config || isLoading}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
        >
          <option value={ConfigType.STRING}>String</option>
          <option value={ConfigType.NUMBER}>Number</option>
          <option value={ConfigType.BOOLEAN}>Boolean</option>
          <option value={ConfigType.JSON}>JSON</option>
        </select>
      </div>

      <div>
        <label htmlFor="value" className="block text-sm font-medium text-gray-700">
          Value <span className="text-red-500">*</span>
        </label>
        {formData.type === ConfigType.JSON ? (
          <textarea
            id="value"
            name="value"
            value={formData.value}
            onChange={handleChange}
            disabled={isLoading}
            rows={6}
            placeholder='{"key": "value"}'
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
          />
        ) : (
          <input
            type={formData.type === ConfigType.NUMBER ? 'number' : 'text'}
            id="value"
            name="value"
            value={formData.value}
            onChange={handleChange}
            disabled={isLoading}
            placeholder={
              formData.type === ConfigType.STRING
                ? 'Enter value'
                : formData.type === ConfigType.NUMBER
                ? '123'
                : 'true/false'
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Optional description"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {(validationError || error) && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{validationError || error}</p>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : config ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
