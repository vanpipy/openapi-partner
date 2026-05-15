/**
 * Projects Page
 * Main page for managing API projects
 */

import { listProjects } from '@/app/actions/project';
import { ProjectList } from '@/components/project/ProjectList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, BookOpen, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex flex-col space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">API Type Automation</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Generate TypeScript types from your OpenAPI specifications
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project List */}
          <div className="lg:col-span-2">
            <ProjectList initialProjects={projects} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    <span className="font-medium">Create a project</span>
                    <p className="text-muted-foreground pl-5">
                      Add your Swagger/OpenAPI URL
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-medium">Generate a token</span>
                    <p className="text-muted-foreground pl-5">
                      Get API access credentials
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-medium">Trigger a sync</span>
                    <p className="text-muted-foreground pl-5">
                      Generate TypeScript types
                    </p>
                  </li>
                  <li className="space-y-1">
                    <span className="font-medium">Use the API</span>
                    <p className="text-muted-foreground pl-5">
                      Access types via token
                    </p>
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* API Docs */}
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
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`curl -H "Authorization: Bearer <token>" \\
  ${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/types`}
                </pre>
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
          </div>
        </div>
      </div>
    </div>
  );
}
