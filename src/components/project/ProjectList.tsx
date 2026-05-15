'use client';

/**
 * Project List Component
 * Display list of projects with actions
 */

import { useState, useTransition, useCallback } from 'react';
import { deleteProject, triggerProjectSync, listProjects } from '@/app/actions/project';
import { ProjectForm } from './ProjectForm';
import Link from 'next/link';

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<number | null>(null);

  const refreshProjects = useCallback(async () => {
    const updatedProjects = await listProjects();
    setProjects(updatedProjects);
  }, []);

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

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
          // In a real app, you'd redirect to task page or show SSE connection
        }
      } finally {
        setSyncingProjectId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium mb-4">Create New Project</h3>
          <ProjectForm
            onSuccess={() => {
              setShowCreateForm(false);
              refreshProjects();
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No projects yet. Create one to get started!
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white p-4 rounded-lg shadow border hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {project.name}
                    </Link>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        project.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {project.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {project.swaggerUrl}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Output: {project.outputPath}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleSync(project.id)}
                    disabled={isPending || syncingProjectId === project.id || !project.isActive}
                    className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    {syncingProjectId === project.id ? 'Syncing...' : 'Sync'}
                  </button>
                  <button
                    onClick={() => setEditingProject(project)}
                    className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={isPending}
                    className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingProject?.id === project.id && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Edit Project</h4>
                  <ProjectForm
                    project={editingProject}
                    onSuccess={() => {
                      setEditingProject(null);
                      refreshProjects();
                    }}
                    onCancel={() => setEditingProject(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
