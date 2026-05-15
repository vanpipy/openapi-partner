/**
 * Project Detail Page
 * Shows project details, tokens, and task history
 */

import { notFound, redirect } from 'next/navigation';
import { getProjectWithDetails, deleteProject } from '@/app/actions/project';
import { getProjectTokens } from '@/app/actions/token';
import { getProjectTasks } from '@/app/actions/tasks';
import { TokenManager } from '@/components/token/TokenManager';
import { TaskProgress } from '@/components/task/TaskProgress';
import { ProjectSettings } from '@/components/project/ProjectSettings';
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
  Zap,
  Code,
  BookOpen,
  Terminal,
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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com';

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
              href={project.specUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-blue-600"
            >
              {project.specUrl}
            </a>
            {(project.specVersion || project.specType !== 'auto-detect') && (
              <Badge 
                variant={project.wasConvertedFromSwagger2 ? "secondary" : "outline"}
                className={project.wasConvertedFromSwagger2 ? "bg-yellow-100 text-yellow-800 ml-2" : "ml-2"}
              >
                {project.specVersion || project.specType}
              </Badge>
            )}
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
          <TabsTrigger value="help" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Help
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
          <ProjectSettings project={project} />
        </TabsContent>

        {/* Help Tab */}
        <TabsContent value="help" className="space-y-6">
          {/* Quick Start */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li className="space-y-1">
                  <span className="font-medium">Generate a token</span>
                  <p className="text-muted-foreground pl-5">
                    Go to API Tokens tab and create a new token
                  </p>
                </li>
                <li className="space-y-1">
                  <span className="font-medium">Trigger a sync</span>
                  <p className="text-muted-foreground pl-5">
                    Go to Tasks tab and click "Sync Now" to generate types
                  </p>
                </li>
                <li className="space-y-1">
                  <span className="font-medium">Access the API</span>
                  <p className="text-muted-foreground pl-5">
                    Use your token to access generated types
                  </p>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* API Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                API Usage
              </CardTitle>
              <CardDescription>
                Access generated types programmatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Fetch all types</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -H "Authorization: Bearer <your-token>" \\
  ${apiUrl}/api/types?projectId=${projectId}`}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Download as ZIP</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -H "Authorization: Bearer <your-token>" \\
  ${apiUrl}/api/tasks/<task-id>/download`}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Get task status</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -H "Authorization: Bearer <your-token>" \\
  ${apiUrl}/api/tasks/<task-id>/events`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Vite Plugin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Vite Plugin
              </CardTitle>
              <CardDescription>
                Auto-import types in your Vite project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Install</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`npm install vite-plugin-openapi-partner`}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">vite.config.ts</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`import { defineConfig } from 'vite';
import openapiPartner from 'vite-plugin-openapi-partner';

export default defineConfig({
  plugins: [
    openapiPartner({
      apiUrl: '${apiUrl}',
      projectId: ${projectId},
      apiKey: '<your-token>',
    }),
  ],
});`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a 
                href="https://swagger.io/specification/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                OpenAPI Specification →
              </a>
              <a 
                href="https://swagger.io/tools/swagger-codegen/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                Swagger Codegen →
              </a>
              <a 
                href="https://www.typescriptlang.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                TypeScript Documentation →
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
