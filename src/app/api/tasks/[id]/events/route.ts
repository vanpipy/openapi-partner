/**
 * SSE Endpoint for Task Events
 * Streams real-time task status updates to connected clients
 */

import { addTaskListener, removeTaskListener } from '@/lib/events';
import { getTask } from '@/lib/tasks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Text encoder for SSE
const encoder = new TextEncoder();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  // Verify task exists with retry logic for database locks
  let task = null;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      task = await getTask(taskId);
      break;
    } catch (error: unknown) {
      const err = error as { code?: string };
      attempts++;
      if (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_LOCKED') {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        continue;
      }
      throw error;
    }
  }

  if (!task) {
    return new Response('Task not found', { status: 404 });
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Register listener
      const listenerId = addTaskListener(taskId, controller);

      // Send initial task state
      const initialEvent = JSON.stringify({
        type: 'init',
        taskId,
        status: task?.status,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initialEvent}\n\n`));

      // Handle cleanup on close
      request.signal.addEventListener('abort', () => {
        removeTaskListener(listenerId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
