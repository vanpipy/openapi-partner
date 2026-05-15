'use client';

/**
 * Project List Component
 * Display list of projects with actions using shadcn/ui
 */

import { useState, useTransition, useCallback } from 'react';
import { deleteProject, triggerProjectSync, listProjects } from '@/app/actions/project';
import { ProjectForm } from './ProjectForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  MoreHorizontal, 
  RefreshCw, 
  Pencil, 
  Trash2,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectListItem {
  id: number;
  name: string;
  swaggerUrl: string;
  outputPath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectListProps {
  initialProjects: ProjectListItem[];
}

export function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [isPending, startTransition] = useTransition();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<number | null>(null);

  const refreshProjects = useCallback(async () => {
    const updatedProjects = await listProjects();
    setProjects(updatedProjects);
  }, []);

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    startTransition(async () => {
      await deleteProject(id);
      await refreshProjects();
    });
  };

  const handleSync = (id: number) => {
    startTransition(async () => {
      setSyncingProjectId(id);
      try {
        const result = await triggerProjectSync(id);
        if (result.success) {
          console.log('Sync started:', result.taskId);
        }
      } finally {
        setSyncingProjectId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            Manage your API type generation projects
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new Swagger/OpenAPI specification to generate types
              </DialogDescription>
            </DialogHeader>
            <ProjectForm
              onSuccess={() => {
                setShowCreateDialog(false);
                refreshProjects();
              }}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No projects yet</h3>
              <p className="text-muted-foreground">
                Create your first project to get started with API type generation
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Swagger URL</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link 
                        href={`/projects/${project.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      <span className="text-muted-foreground text-sm">
                        {project.swaggerUrl}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {project.outputPath}
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.isActive ? "default" : "secondary"}>
                        {project.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPending}>
                            {syncingProjectId === project.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleSync(project.id)}
                            disabled={!project.isActive || syncingProjectId === project.id}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Sync Types
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingProject(project)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(project.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project settings and configuration
            </DialogDescription>
          </DialogHeader>
          {editingProject && (
            <ProjectForm
              project={editingProject}
              onSuccess={() => {
                setEditingProject(null);
                refreshProjects();
              }}
              onCancel={() => setEditingProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
