'use client';

/**
 * Project List Component
 * Display list of projects with links to detail page
 */

import { useState, useCallback } from 'react';
import { listProjects } from '@/app/actions/project';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus,
  ExternalLink,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectForm } from './ProjectForm';

interface ProjectListItem {
  id: number;
  name: string;
  specUrl: string;
  specType: string;
  outputPath: string;
  apiVersion: string | null;
  baseUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectListProps {
  initialProjects: ProjectListItem[];
}

export function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const refreshProjects = useCallback(async () => {
    const updatedProjects = await listProjects();
    setProjects(updatedProjects);
  }, []);

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
                Add a new OpenAPI/Swagger specification to generate types
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
                  <TableHead>Spec URL</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link 
                        href={`/projects/${project.id}`}
                        className="font-medium text-blue-600 hover:underline flex items-center gap-2"
                      >
                        {project.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      <span className="text-muted-foreground text-sm">
                        {project.specUrl}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
