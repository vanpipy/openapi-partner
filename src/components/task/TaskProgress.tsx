'use client';

/**
 * Task Progress Component
 * Real-time task status display with SSE updates using shadcn/ui
 */

import { useState, useEffect, useCallback, useTransition } from 'react';
import { getProjectTasks, getProjectTaskStats } from '@/app/actions/tasks';
import { triggerProjectSync } from '@/app/actions/project';
import { TaskStatus } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Wifi,
  WifiOff,
  Download,
  Copy,
  FileText,
  ExternalLink,
  Check,
  RefreshCw
} from 'lucide-react';

interface TaskListItem {
  id: string;
  status: string;
  errorMessage: string | null;
  executionLog: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  outputDir?: string | null;
  outputFiles?: string | null;
  outputSize?: number | null;
  downloadCount?: number | null;
  publicToken?: string | null;
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
  taskId?: string;
}

const statusConfig = {
  [TaskStatus.PENDING]: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-muted-foreground',
  },
  [TaskStatus.PROCESSING]: {
    label: 'Processing',
    icon: Loader2,
    variant: 'default' as const,
    color: 'text-blue-600',
  },
  [TaskStatus.SUCCESS]: {
    label: 'Success',
    icon: CheckCircle2,
    variant: 'default' as const,
    color: 'text-green-600',
  },
  [TaskStatus.FAILED]: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    color: 'text-red-600',
  },
};

export function TaskProgress({ projectId, taskId }: TaskProgressProps) {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      setIsSyncing(true);
      try {
        const result = await triggerProjectSync(projectId);
        if (result.success) {
          // Refresh tasks immediately
          await refreshTasks();
          // If it's a new task, the SSE will update us
          // If it's existing, we already have the data
        }
      } finally {
        setIsSyncing(false);
      }
    });
  };

  const refreshTasks = useCallback(async () => {
    try {
      const [taskList, taskStats] = await Promise.all([
        getProjectTasks(projectId, { limit: 20 }),
        getProjectTaskStats(projectId),
      ]);
      setTasks(taskList);
      setStats(taskStats);
      setIsLoading(false);

      if (taskId) {
        const currentTask = taskList.find((t) => t.id === taskId);
        if (currentTask) {
          setSelectedTask(currentTask);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setIsLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    // Always refresh tasks on mount
    refreshTasks();

    // Poll for updates every 2 seconds when syncing, otherwise every 5 seconds
    const pollInterval = setInterval(() => {
      if (isSyncing) {
        refreshTasks();
      }
    }, isSyncing ? 2000 : 5000);

    // Connect to SSE for specific task if provided
    let eventSource: EventSource | null = null;

    if (taskId) {
      eventSource = new EventSource(`/api/tasks/${taskId}/events`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Refresh tasks on any task event
          if (['init', 'started', 'progress', 'completed', 'failed'].includes(data.type)) {
            refreshTasks();
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        // Retry connection after 5 seconds
        setTimeout(() => {
          if (taskId) {
            eventSource = new EventSource(`/api/tasks/${taskId}/events`);
          }
        }, 5000);
      };
    }

    return () => {
      eventSource?.close();
      clearInterval(pollInterval);
    };
  }, [taskId, refreshTasks, isSyncing]);

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const formatDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return '-';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    return `${(diff / 60000).toFixed(1)}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
          <CardDescription>Loading tasks...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Task History
            </CardTitle>
            <CardDescription>
              Monitor type generation tasks and their status
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={handleSync} disabled={isSyncing} size="sm">
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Now
            </Button>
            
            {taskId && (
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">...</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-2">
            <StatCard 
              label="Total" 
              value={stats.total} 
              icon={Activity}
              className="bg-muted"
            />
            <StatCard 
              label="Pending" 
              value={stats.pending} 
              icon={Clock}
              variant="secondary"
            />
            <StatCard 
              label="Processing" 
              value={stats.processing} 
              icon={Loader2}
              variant="default"
              className="text-blue-600"
            />
            <StatCard 
              label="Success" 
              value={stats.success} 
              icon={CheckCircle2}
              variant="default"
              className="text-green-600"
            />
            <StatCard 
              label="Failed" 
              value={stats.failed} 
              icon={XCircle}
              variant="destructive"
            />
          </div>
        )}

        <Separator />

        {/* Task List */}
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tasks yet. Trigger a sync to generate types.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr,1fr] gap-4">
            {/* Task List */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const config = statusConfig[task.status as keyof typeof statusConfig] || statusConfig[TaskStatus.PENDING];
                    const StatusIcon = config.icon;
                    
                    return (
                      <TableRow 
                        key={task.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedTask?.id === task.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {task.id.slice(0, 8)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className={config.color}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${task.status === TaskStatus.PROCESSING ? 'animate-spin' : ''}`} />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDuration(task.startedAt, task.completedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Task Details */}
            <div className="border rounded-lg p-4 overflow-hidden flex flex-col">
              {selectedTask ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Task Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Created</div>
                      <div>{formatDate(selectedTask.createdAt)}</div>
                      <div className="text-muted-foreground">Started</div>
                      <div>{formatDate(selectedTask.startedAt)}</div>
                      <div className="text-muted-foreground">Completed</div>
                      <div>{formatDate(selectedTask.completedAt)}</div>
                    </div>
                  </div>

                  <Separator />

                  {selectedTask.errorMessage && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">Error</h4>
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                        {selectedTask.errorMessage}
                      </div>
                    </div>
                  )}
                  
                  {/* Download Section - Only for completed tasks */}
                  {selectedTask.status === TaskStatus.SUCCESS && selectedTask.outputFiles && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Downloads
                      </h4>
                      
                      {/* Generated Files */}
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          Generated Files ({selectedTask.outputSize ? `${(selectedTask.outputSize / 1024).toFixed(1)} KB` : 'N/A'})
                        </div>
                        <div className="space-y-1">
                          {JSON.parse(selectedTask.outputFiles).map((file: string) => (
                            <div 
                              key={file}
                              className="flex items-center gap-2 text-sm bg-muted p-2 rounded"
                            >
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <code className="flex-1">{file}</code>
                              <a
                                href={`/api/files/${selectedTask.id}/${file}`}
                                download
                                className="text-blue-600 hover:underline text-xs"
                              >
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Download Buttons */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <a
                          href={`/api/tasks/${selectedTask.id}/download`}
                          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90"
                          download
                        >
                          <Download className="h-4 w-4" />
                          Download ZIP
                        </a>
                        
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/api/public/${selectedTask.publicToken}`;
                            navigator.clipboard.writeText(url);
                            // Could add toast notification here
                          }}
                          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-muted"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Public Link
                        </button>
                      </div>
                      
                      {/* Public Download Link */}
                      {selectedTask.publicToken && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-green-700 text-sm mb-2">
                            <ExternalLink className="h-4 w-4" />
                            Public Download (No Auth Required)
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                              {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/${selectedTask.publicToken}`}
                            </code>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/api/public/${selectedTask.publicToken}`;
                                navigator.clipboard.writeText(url);
                              }}
                              className="p-2 hover:bg-green-100 rounded"
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4 text-green-700" />
                            </button>
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Downloads: {selectedTask.downloadCount || 0}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTask.executionLog && (
                    <div className="flex-shrink-0">
                      <h4 className="font-medium mb-2">Execution Log</h4>
                      <ScrollArea className="h-32 w-full">
                        <pre className="text-xs bg-black text-green-400 p-3 rounded whitespace-pre-wrap break-all max-w-full">
                          {selectedTask.executionLog}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a task to view details
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default' as const,
  className = '',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'secondary' | 'destructive';
  className?: string;
}) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-red-100 text-red-700',
  };

  return (
    <div className={`rounded-lg p-3 text-center space-y-1 ${variantStyles[variant]} ${className}`}>
      <Icon className="h-4 w-4 mx-auto opacity-60" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}
