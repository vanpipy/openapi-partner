'use client';

/**
 * Project Form Component
 * Form for creating and editing projects using shadcn/ui
 */

import { useState, useTransition } from 'react';
import { createProject, updateProject, type CreateProjectInput } from '@/app/actions/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

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
        const result = await updateProject({
          id: project.id,
          ...input,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }
      } else {
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={project?.name}
          placeholder="My API Project"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="swaggerUrl">Swagger/OpenAPI URL *</Label>
        <Input
          id="swaggerUrl"
          name="swaggerUrl"
          type="url"
          required
          defaultValue={project?.swaggerUrl}
          placeholder="https://petstore.swagger.io/v2/swagger.json"
        />
        <p className="text-sm text-muted-foreground">
          Enter the URL to your OpenAPI or Swagger specification
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outputPath">Output Path</Label>
        <Input
          id="outputPath"
          name="outputPath"
          defaultValue={project?.outputPath || './generated'}
          placeholder="./generated"
        />
        <p className="text-sm text-muted-foreground">
          Directory where generated types will be saved
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="apiVersion">API Version</Label>
          <Input
            id="apiVersion"
            name="apiVersion"
            defaultValue={project?.apiVersion || ''}
            placeholder="1.0.0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            name="baseUrl"
            defaultValue={project?.baseUrl || ''}
            placeholder="https://api.example.com"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {project ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
