'use client';

/**
 * Project Settings Component
 * Handles edit and delete actions
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProject, deleteProject } from '@/app/actions/project';
import { ProjectForm } from './ProjectForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Calendar,
  FolderOutput,
  Globe,
  Hash,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';

interface ProjectSettingsProps {
  project: {
    id: number;
    name: string;
    specUrl: string;
    specType: string;
    specVersion: string | null;
    wasConvertedFromSwagger2: boolean | null;
    outputPath: string;
    apiVersion: string | null;
    baseUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function ProjectSettings({ project, onUpdate, onDelete }: ProjectSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(project.id);
      onDelete?.();
      router.push('/projects');
    });
  };

  return (
    <div className="space-y-6">
      {/* Project Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Configuration</CardTitle>
            <CardDescription>
              View and manage project settings
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                  <DialogDescription>
                    Update project settings and configuration
                  </DialogDescription>
                </DialogHeader>
                <ProjectForm
                  project={project}
                  onSuccess={() => {
                    setShowEditDialog(false);
                    onUpdate?.();
                  }}
                  onCancel={() => setShowEditDialog(false)}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Project</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this project? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderOutput className="h-4 w-4" />
                <span className="text-sm font-medium">Output Path</span>
              </div>
              <p className="font-mono text-sm">{project.outputPath}</p>
            </div>

            {project.apiVersion && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span className="text-sm font-medium">API Version</span>
                </div>
                <p className="font-mono text-sm">{project.apiVersion}</p>
              </div>
            )}

            {project.baseUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">Base URL</span>
                </div>
                <p className="font-mono text-sm">{project.baseUrl}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <p className="text-sm">{new Date(project.createdAt).toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <p className="text-sm">{new Date(project.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Spec URL</div>
            <div className="flex gap-2">
              <code className="flex-1 text-sm bg-muted p-3 rounded-lg overflow-x-auto">
                {project.specUrl}
              </code>
              <Button variant="outline" size="icon" asChild>
                <a href={project.specUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          
          {project.specVersion && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Detected Version</div>
              <Badge 
                variant={project.wasConvertedFromSwagger2 ? "secondary" : "outline"}
                className={project.wasConvertedFromSwagger2 ? "bg-yellow-100 text-yellow-800" : ""}
              >
                {project.specVersion}
                {project.wasConvertedFromSwagger2 && ' (converted from Swagger 2.0)'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
