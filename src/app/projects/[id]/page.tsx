/**
 * Project Detail Page
 * Shows project details, tokens, and task history
 */

import { notFound } from 'next/navigation';
import { getProjectWithDetails } from '@/app/actions/project';
import { getProjectTokens } from '@/app/actions/token';
import { getProjectTasks } from '@/app/actions/tasks';
import { TokenManager } from '@/components/token/TokenManager';
import { TaskProgress } from '@/components/task/TaskProgress';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Key,
  Activity,
  Calendar,
  FolderOutput,
  Globe,
  Hash,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const projectId = parseInt(id);

  if (isNaN(projectId)) {
    notFound();
  }

  const [project, tokens, tasks] = await Promise.all([
    getProjectWithDetails(projectId),
    getProjectTokens(projectId),
    getProjectTasks(projectId, { limit: 10 }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant={project.isActive ? "default" : "secondary"}>
              {project.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
            <a 
              href={project.swaggerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-blue-600"
            >
              {project.swaggerUrl}
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tokens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tokens" className="gap-2">
            <Key className="h-4 w-4" />
            API Tokens
            <Badge variant="secondary" className="ml-1">
              {tokens.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <Activity className="h-4 w-4" />
            Tasks
            <Badge variant="secondary" className="ml-1">
              {project.tokenCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="space-y-6">
          <TokenManager projectId={projectId} initialTokens={tokens} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <TaskProgress projectId={projectId} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Configuration</CardTitle>
              <CardDescription>
                View and manage project settings
              </CardDescription>
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
                <div className="text-sm font-medium">Swagger URL</div>
                <div className="flex gap-2">
                  <code className="flex-1 text-sm bg-muted p-3 rounded-lg overflow-x-auto">
                    {project.swaggerUrl}
                  </code>
                  <Button variant="outline" size="icon" asChild>
                    <a href={project.swaggerUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
