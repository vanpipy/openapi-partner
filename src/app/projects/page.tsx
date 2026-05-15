/**
 * Projects Page
 * Main page for managing API projects
 */

import { listProjects } from '@/app/actions/project';
import { ProjectList } from '@/components/project/ProjectList';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">API Type Automation</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ProjectList initialProjects={projects} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium mb-4">Quick Start</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Create a new project with your Swagger URL</li>
              <li>Generate an API token</li>
              <li>Trigger a sync to generate types</li>
              <li>Access generated types via token</li>
            </ol>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium mb-4">API Documentation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Use your API token to access generated types programmatically.
            </p>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
{`curl -H "Authorization: Bearer <token>" \\
  https://your-domain.com/api/types`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
