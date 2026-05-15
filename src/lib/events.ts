/**
 * Event Emitter for Task SSE Updates
 * Simple in-memory pub/sub for broadcasting task events to connected clients
 */

// Event listener type
interface EventListener {
  id: string;
  taskId: string;
  controller: ReadableStreamDefaultController;
  createdAt: Date;
}

// Active listeners
const listeners = new Map<string, EventListener>();

/**
 * Add a listener for task events
 */
export function addTaskListener(
  taskId: string,
  controller: ReadableStreamDefaultController
): string {
  const id = crypto.randomUUID();
  
  listeners.set(id, {
    id,
    taskId,
    controller,
    createdAt: new Date(),
  });

  // Send initial connection event
  sendToListener(id, {
    type: 'connected',
    taskId,
    timestamp: new Date().toISOString(),
  });

  return id;
}

/**
 * Remove a listener
 */
export function removeTaskListener(id: string): void {
  listeners.delete(id);
}

/**
 * Send event to all listeners for a specific task
 */
export function broadcastTaskEvent(
  taskId: string,
  event: {
    type: string;
    status?: string;
    message?: string;
    executionLog?: string;
    errorMessage?: string;
    progress?: number;
  }
): void {
  const payload = JSON.stringify({
    ...event,
    taskId,
    timestamp: new Date().toISOString(),
  });

  for (const [id, listener] of listeners) {
    if (listener.taskId === taskId) {
      try {
        listener.controller.enqueue(`data: ${payload}\n\n`);
      } catch {
        // Listener disconnected, remove it
        listeners.delete(id);
      }
    }
  }
}

/**
 * Send event to a specific listener
 */
export function sendToListener(
  id: string,
  event: Record<string, unknown>
): void {
  const listener = listeners.get(id);
  if (!listener) return;

  try {
    listener.controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // Listener disconnected, remove it
    listeners.delete(id);
  }
}

/**
 * Get count of active listeners for a task
 */
export function getListenerCount(taskId: string): number {
  let count = 0;
  for (const listener of listeners.values()) {
    if (listener.taskId === taskId) {
      count++;
    }
  }
  return count;
}

/**
 * Cleanup stale listeners (older than maxAge ms)
 */
export function cleanupStaleListeners(maxAgeMs: number = 60000): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, listener] of listeners) {
    const age = now.getTime() - listener.createdAt.getTime();
    if (age >= maxAgeMs) {
      try {
        listener.controller.close();
      } catch {
        // Already closed
      }
      listeners.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}
