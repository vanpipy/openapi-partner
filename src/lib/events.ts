/**
 * Event Emitter for Task SSE Updates
 * Simple in-memory pub/sub for broadcasting task events to connected clients
 * Events are also stored in database for new clients to receive on connect
 */

import { getDb } from './db';
import { tasks } from './db/schema';
import { eq } from 'drizzle-orm';

// Event listener type
interface EventListener {
  id: string;
  taskId: string;
  controller: ReadableStreamDefaultController;
  createdAt: Date;
}

// Active listeners
const listeners = new Map<string, EventListener>();

// Text encoder for SSE
const encoder = new TextEncoder();

/**
 * Encode string to Uint8Array for streaming
 */
function encode(data: string): Uint8Array {
  return encoder.encode(data);
}

/**
 * Get total listener count for debugging
 */
export function getTotalListenerCount(): number {
  return listeners.size;
}

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
 * Store event in database for late-connecting clients
 */
async function storeEventInDb(taskId: string, event: Record<string, unknown>): Promise<void> {
  try {
    const db = getDb();
    const task = await db.select({ sseEvents: tasks.sseEvents }).from(tasks).where(eq(tasks.id, taskId)).get();
    
    if (task) {
      const events = JSON.parse(task.sseEvents || '[]');
      events.push({ ...event, timestamp: new Date().toISOString() });
      await db.update(tasks).set({ sseEvents: JSON.stringify(events) }).where(eq(tasks.id, taskId));
      console.log(`[SSE] Stored event '${event.type}' for task ${taskId}, total stored: ${events.length}`);
    }
  } catch (e) {
    console.error('Failed to store SSE event in DB:', e);
  }
}

/**
 * Get and clear stored events from database
 */
export async function getAndClearStoredEvents(taskId: string): Promise<Record<string, unknown>[]> {
  try {
    const db = getDb();
    const task = await db.select({ sseEvents: tasks.sseEvents }).from(tasks).where(eq(tasks.id, taskId)).get();
    
    if (task && task.sseEvents) {
      const events = JSON.parse(task.sseEvents) as Record<string, unknown>[];
      console.log(`[SSE] Retrieved ${events.length} stored events for task ${taskId}`);
      // Clear stored events after retrieval
      await db.update(tasks).set({ sseEvents: '[]' }).where(eq(tasks.id, taskId));
      return events;
    } else {
      console.log(`[SSE] No stored events for task ${taskId}`);
    }
  } catch (e) {
    console.error('Failed to get stored SSE events from DB:', e);
  }
  return [];
}

/**
 * Send event to all listeners for a specific task
 * Also stores event in database for late-connecting clients
 * Returns the number of listeners the event was sent to
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
    outputPath?: string;
    outputSize?: number;
  }
): number {
  const payload = JSON.stringify({
    ...event,
    taskId,
    timestamp: new Date().toISOString(),
  });
  
  const data = encode(`data: ${payload}\n\n`);
  let sentCount = 0;

  for (const [id, listener] of listeners) {
    if (listener.taskId === taskId) {
      try {
        listener.controller.enqueue(data);
        sentCount++;
      } catch {
        // Listener disconnected, remove it
        listeners.delete(id);
      }
    }
  }
  
  // Fire-and-forget: store event in database for late-connecting clients
  // This is async and should not block the SSE broadcast
  storeEventInDb(taskId, { ...event, taskId }).catch((e) => {
    console.error('Failed to store SSE event in DB:', e);
  });
  
  return sentCount;
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
    listener.controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
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
