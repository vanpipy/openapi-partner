/**
 * SSE Endpoint for Task Events
 * Real-time task status updates
 */

import { NextRequest } from 'next/server';
import { validateApiToken } from '@/app/actions/token';
import { getTask } from '@/lib/tasks';
import { TaskStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;

  // Validate authentication
  const authResult = await validateApiToken(
    request.headers.get('Authorization')
  );

  if (!authResult.success) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify task belongs to user's project
  const task = await getTask(taskId);

  if (!task) {
    return new Response('Task not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial task state
      const sendEvent = (data: object) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial status
      sendEvent({
        type: 'status',
        taskId: task.id,
        status: task.status,
        timestamp: new Date().toISOString(),
      });

      // Poll for updates (simple implementation)
      // In production, use Redis Pub/Sub or similar
      const pollInterval = setInterval(async () => {
        try {
          const currentTask = await getTask(taskId);

          if (!currentTask) {
            clearInterval(pollInterval);
            sendEvent({
              type: 'error',
              message: 'Task not found',
              timestamp: new Date().toISOString(),
            });
            controller.close();
            return;
          }

          // Send update if status changed
          if (currentTask.status !== task.status) {
            sendEvent({
              type: 'status',
              taskId: currentTask.id,
              status: currentTask.status,
              timestamp: new Date().toISOString(),
            });

            // Close stream when task completes
            if (
              currentTask.status === TaskStatus.SUCCESS ||
              currentTask.status === TaskStatus.FAILED
            ) {
              clearInterval(pollInterval);
              sendEvent({
                type: 'completed',
                taskId: currentTask.id,
                status: currentTask.status,
                errorMessage: currentTask.errorMessage,
                executionLog: currentTask.executionLog,
                timestamp: new Date().toISOString(),
              });
              controller.close();
              return;
            }
          }

          // Send progress updates if there's new log
          if (currentTask.executionLog && currentTask.executionLog !== task.executionLog) {
            sendEvent({
              type: 'progress',
              taskId: currentTask.id,
              executionLog: currentTask.executionLog,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('SSE poll error:', error);
          clearInterval(pollInterval);
          sendEvent({
            type: 'error',
            message: 'Internal server error',
            timestamp: new Date().toISOString(),
          });
          controller.close();
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
