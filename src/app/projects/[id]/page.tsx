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
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/projects"
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{project.swaggerUrl}</p>
        </div>
        <span
          className={`px-3 py-1 text-sm rounded ${
            project.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {project.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b mb-6">
        <nav className="flex gap-4">
          <a
            href="#tokens"
            className="pb-2 px-1 text-sm font-medium border-b-2 border-blue-600 text-blue-600"
          >
            API Tokens ({tokens.length})
          </a>
          <a
            href="#tasks"
            className="pb-2 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            Tasks ({project.tokenCount})
          </a>
          <a
            href="#settings"
            className="pb-2 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            Settings
          </a>
        </nav>
      </div>

      {/* Tokens Section */}
      <section id="tokens" className="mb-12">
        <TokenManager projectId={projectId} initialTokens={tokens} />
      </section>

      {/* Tasks Section */}
      <section id="tasks" className="mb-12">
        <h3 className="text-lg font-medium mb-4">Task History</h3>
        <TaskProgress projectId={projectId} />
      </section>

      {/* Settings Section */}
      <section id="settings" className="mb-12">
        <h3 className="text-lg font-medium mb-4">Project Settings</h3>
        <div className="bg-white p-6 rounded-lg shadow border space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Output Path</label>
            <p className="text-gray-600">{project.outputPath}</p>
          </div>
          {project.apiVersion && (
            <div>
              <label className="block text-sm font-medium text-gray-700">API Version</label>
              <p className="text-gray-600">{project.apiVersion}</p>
            </div>
          )}
          {project.baseUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Base URL</label>
              <p className="text-gray-600">{project.baseUrl}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Created</label>
            <p className="text-gray-600">{new Date(project.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
