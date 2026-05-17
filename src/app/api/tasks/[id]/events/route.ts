/**
 * SSE Endpoint for Task Events
 * Streams real-time task status updates to connected clients
 */

import { addTaskListener, removeTaskListener, getAndClearStoredEvents } from '@/lib/events';
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

  console.log(`[SSE] Client connecting to task ${taskId}`);

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
    console.log(`[SSE] Task ${taskId} not found`);
    return new Response('Task not found', { status: 404 });
  }

  console.log(`[SSE] Task ${taskId} found, status=${task.status}`);

  // Get any stored events for this task (events that happened before client connected)
  const storedEvents = await getAndClearStoredEvents(taskId);
  console.log(`[SSE] Sending ${storedEvents.length} stored events to client`);

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Register listener
      const listenerId = addTaskListener(taskId, controller);
      console.log(`[SSE] Listener ${listenerId} registered for task ${taskId}`);

      // Send initial task state
      const initialEvent = JSON.stringify({
        type: 'init',
        taskId,
        status: task?.status,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initialEvent}\n\n`));
      console.log(`[SSE] Sent init event`);

      // Send any stored events (events that happened before client connected)
      for (const event of storedEvents) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        console.log(`[SSE] Sent stored event: ${event.type}`);
      }

      // Handle cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected for task ${taskId}`);
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
