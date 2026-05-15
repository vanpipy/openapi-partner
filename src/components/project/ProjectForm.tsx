'use client';

/**
 * Project Form Component
 * Form for creating and editing projects
 */

import { useState, useTransition } from 'react';
import { createProject, updateProject, type CreateProjectInput } from '@/app/actions/project';

export interface ProjectFormProps {
  project?: {
    id: number;
    name: string;
    swaggerUrl: string;
    outputPath: string;
    apiVersion: string | null;
    baseUrl: string | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProjectForm({ project, onSuccess, onCancel }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    const input: CreateProjectInput = {
      name: formData.get('name') as string,
      swaggerUrl: formData.get('swaggerUrl') as string,
      outputPath: formData.get('outputPath') as string || './generated',
      apiVersion: formData.get('apiVersion') as string || undefined,
      baseUrl: formData.get('baseUrl') as string || undefined,
    };

    startTransition(async () => {
      if (project) {
        // Update existing project
        const result = await updateProject({
          id: project.id,
          ...input,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }
      } else {
        // Create new project
        const result = await createProject(input);

        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Project Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={project?.name}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="My API Project"
        />
      </div>

      <div>
        <label htmlFor="swaggerUrl" className="block text-sm font-medium text-gray-700">
          Swagger/OpenAPI URL *
        </label>
        <input
          type="url"
          id="swaggerUrl"
          name="swaggerUrl"
          required
          defaultValue={project?.swaggerUrl}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="https://petstore.swagger.io/v2/swagger.json"
        />
      </div>

      <div>
        <label htmlFor="outputPath" className="block text-sm font-medium text-gray-700">
          Output Path
        </label>
        <input
          type="text"
          id="outputPath"
          name="outputPath"
          defaultValue={project?.outputPath || './generated'}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="./generated"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="apiVersion" className="block text-sm font-medium text-gray-700">
            API Version
          </label>
          <input
            type="text"
            id="apiVersion"
            name="apiVersion"
            defaultValue={project?.apiVersion || ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="1.0.0"
          />
        </div>

        <div>
          <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700">
            Base URL
          </label>
          <input
            type="text"
            id="baseUrl"
            name="baseUrl"
            defaultValue={project?.baseUrl || ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="https://api.example.com"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}
