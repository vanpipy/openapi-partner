'use client';

/**
 * Task Progress Component
 * Real-time task status display with SSE updates
 */

import { useState, useEffect, useCallback } from 'react';
import { getProjectTasks, getProjectTaskStats } from '@/app/actions/tasks';
import { TaskStatus } from '@/lib/db';

interface TaskListItem {
  id: string;
  status: string;
  errorMessage: string | null;
  executionLog: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface TaskStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
}

interface TaskProgressProps {
  projectId: number;
  taskId?: string; // If provided, show real-time updates for this task
}

export function TaskProgress({ projectId, taskId }: TaskProgressProps) {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const refreshTasks = useCallback(async () => {
    const [taskList, taskStats] = await Promise.all([
      getProjectTasks(projectId, { limit: 20 }),
      getProjectTaskStats(projectId),
    ]);
    setTasks(taskList);
    setStats(taskStats);

    // Update selected task if it exists
    if (taskId) {
      const currentTask = taskList.find((t) => t.id === taskId);
      if (currentTask) {
        setSelectedTask(currentTask);
      }
    }
  }, [projectId, taskId]);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!taskId) return;

    const connectSSE = () => {
      const eventSource = new EventSource(`/api/tasks/${taskId}/events`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status' || data.type === 'progress' || data.type === 'completed') {
            refreshTasks();
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };

      return eventSource;
    };

    const eventSource = connectSSE();

    // Initial refresh
    refreshTasks();

    // Poll for updates (backup to SSE)
    const pollInterval = setInterval(refreshTasks, 5000);

    return () => {
      eventSource?.close();
      clearInterval(pollInterval);
    };
  }, [taskId, refreshTasks]);

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case TaskStatus.SUCCESS:
        return 'bg-green-100 text-green-800';
      case TaskStatus.FAILED:
        return 'bg-red-100 text-red-800';
      case TaskStatus.PROCESSING:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.PENDING:
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statusLabels: Record<string, string> = {
    [TaskStatus.PENDING]: 'Pending',
    [TaskStatus.PROCESSING]: 'Processing',
    [TaskStatus.SUCCESS]: 'Success',
    [TaskStatus.FAILED]: 'Failed',
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} color="gray" />
          <StatCard label="Processing" value={stats.processing} color="blue" />
          <StatCard label="Success" value={stats.success} color="green" />
          <StatCard label="Failed" value={stats.failed} color="red" />
        </div>
      )}

      {/* SSE Connection Status */}
      {taskId && (
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-gray-500">
            {isConnected ? 'Connected - receiving live updates' : 'Connecting...'}
          </span>
        </div>
      )}

      {/* Task List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h3 className="font-medium">Task History</h3>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No tasks yet. Trigger a sync to generate types.
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                  selectedTask?.id === task.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-sm text-gray-600">
                      {task.id.slice(0, 8)}...
                    </span>
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {statusLabels[task.status] || task.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(task.createdAt)}
                  </span>
                </div>

                {/* Selected task details */}
                {selectedTask?.id === task.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {task.startedAt && (
                      <div className="text-sm">
                        <span className="text-gray-500">Started:</span>{' '}
                        {formatDate(task.startedAt)}
                      </div>
                    )}
                    {task.completedAt && (
                      <div className="text-sm">
                        <span className="text-gray-500">Completed:</span>{' '}
                        {formatDate(task.completedAt)}
                      </div>
                    )}
                    {task.errorMessage && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        Error: {task.errorMessage}
                      </div>
                    )}
                    {task.executionLog && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-500 block mb-1">
                          Execution Log:
                        </span>
                        <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto max-h-48">
                          {task.executionLog}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: number;
  color?: 'gray' | 'blue' | 'green' | 'red';
}) {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`rounded-lg p-2 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
