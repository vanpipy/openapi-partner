'use client';

/**
 * Task Progress Component
 * Real-time task status display with SSE updates using shadcn/ui
 */

import { useState, useEffect, useCallback } from 'react';
import { getProjectTasks, getProjectTaskStats } from '@/app/actions/tasks';
import { TaskStatus } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  WifiOff
} from 'lucide-react';

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
    if (!taskId) {
      refreshTasks();
      return;
    }

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
        setTimeout(connectSSE, 5000);
      };

      return eventSource;
    };

    const eventSource = connectSSE();
    refreshTasks();

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
          
          {taskId && (
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Live updates active</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Connecting...</span>
                </>
              )}
            </div>
          )}
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
            <div className="border rounded-lg p-4">
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

                  {selectedTask.executionLog && (
                    <div>
                      <h4 className="font-medium mb-2">Execution Log</h4>
                      <ScrollArea className="h-48">
                        <pre className="text-xs bg-black text-green-400 p-3 rounded-lg overflow-x-auto">
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
