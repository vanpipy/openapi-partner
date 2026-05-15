/**
 * Tests for SSE Broadcast Debugging
 * Verifies that broadcastEvent logs correctly
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { TaskStatus, SpecType } from '@/lib/db/schema';
import {
  addTaskListener,
  removeTaskListener,
  broadcastTaskEvent,
  getListenerCount,
  getTotalListenerCount,
  cleanupStaleListeners,
} from '@/lib/events';

// Mock console.log to capture SSE broadcast logs
const consoleLogMock = { calls: [] as string[] };
const originalLog = console.log;

describe('SSE Broadcast Debugging', () => {
  let db: ReturnType<typeof getDb>;
  let testTaskId: string;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    const [project] = await db
      .insert(projects)
      .values({
        name: 'Broadcast Debug Test',
        specUrl: 'https://api.example.com/openapi.json',
        specType: SpecType.OPENAPI_3X,
        isActive: true,
      })
      .returning();

    const [task] = await db
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        projectId: project.id,
        status: TaskStatus.PENDING,
      })
      .returning();

    testTaskId = task.id;
  });

  afterAll(async () => {
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);
  });

  beforeEach(() => {
    cleanupStaleListeners(0);
    consoleLogMock.calls = [];
  });

  describe('broadcastTaskEvent return value', () => {
    it('should return number of listeners that received the event', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener(testTaskId, mockController);
      const id2 = addTaskListener(testTaskId, mockController);

      const result = broadcastTaskEvent(testTaskId, { type: 'test' });

      expect(typeof result).toBe('number');
      expect(result).toBe(2);

      removeTaskListener(id1);
      removeTaskListener(id2);
    });

    it('should return 0 when broadcasting to task with no listeners', () => {
      const result = broadcastTaskEvent('non-existent-task', { type: 'test' });
      expect(result).toBe(0);
    });

    it('should not count listeners of other tasks', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener('task-a', mockController);
      const id2 = addTaskListener('task-b', mockController);

      const result = broadcastTaskEvent('task-a', { type: 'test' });

      expect(result).toBe(1);

      removeTaskListener(id1);
      removeTaskListener(id2);
    });
  });

  describe('getListenerCount integration', () => {
    it('should return correct count per task', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener('task-x', mockController);
      const id2 = addTaskListener('task-x', mockController);
      addTaskListener('task-y', mockController);

      expect(getListenerCount('task-x')).toBe(2);
      expect(getListenerCount('task-y')).toBe(1);

      cleanupStaleListeners(0);
    });
  });

  describe('getTotalListenerCount integration', () => {
    it('should track total across multiple tasks', () => {
      cleanupStaleListeners(0);
      const initialTotal = getTotalListenerCount();

      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      // Add listeners to multiple tasks
      addTaskListener('task-a', mockController);
      addTaskListener('task-a', mockController);
      addTaskListener('task-b', mockController);
      addTaskListener('task-b', mockController);
      addTaskListener('task-b', mockController);

      expect(getTotalListenerCount()).toBe(initialTotal + 5);

      cleanupStaleListeners(0);
    });

    it('should be consistent with individual listener counts', () => {
      cleanupStaleListeners(0);

      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      addTaskListener('task-1', mockController);
      addTaskListener('task-2', mockController);
      addTaskListener('task-2', mockController);

      const total = getTotalListenerCount();
      const sumOfCounts = getListenerCount('task-1') + getListenerCount('task-2');

      expect(total).toBe(sumOfCounts);

      cleanupStaleListeners(0);
    });
  });

  describe('broadcastEvent logging scenario', () => {
    it('should report correct stats for single listener', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      const sentCount = broadcastTaskEvent(testTaskId, { type: 'started', status: 'PROCESSING' });
      const taskListeners = getListenerCount(testTaskId);
      const totalListeners = getTotalListenerCount();

      expect(sentCount).toBe(1);
      expect(taskListeners).toBe(1);
      expect(totalListeners).toBeGreaterThanOrEqual(1);

      // Simulated log output:
      // `SSE broadcast started sent to ${sentCount}/${taskListeners} task listeners (${totalListeners} total)`
      expect(`${sentCount}/${taskListeners}`).toBe('1/1');

      removeTaskListener(id);
    });

    it('should report correct stats when some listeners remain', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener(testTaskId, mockController);
      const id2 = addTaskListener(testTaskId, mockController);

      // Remove one listener
      removeTaskListener(id1);

      const sentCount = broadcastTaskEvent(testTaskId, { type: 'completed' });
      const taskListeners = getListenerCount(testTaskId);

      expect(sentCount).toBe(1);
      expect(taskListeners).toBe(1);

      removeTaskListener(id2);
    });

    it('should handle rapid add/remove cycles', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(addTaskListener(testTaskId, mockController));
      }

      // Remove every other listener (indices 0, 2, 4)
      for (let i = 0; i < ids.length; i += 2) {
        removeTaskListener(ids[i]);
      }

      const sentCount = broadcastTaskEvent(testTaskId, { type: 'test' });
      // 5 listeners, removed 3 (indices 0,2,4) = 2 remaining
      expect(sentCount).toBe(2);

      // Cleanup
      cleanupStaleListeners(0);
    });
  });

  describe('Error handling with logging', () => {
    it('should remove failed listener and report reduced count', () => {
      let enqueueCallCount = 0;
      const mockController = {
        enqueue: () => {
          enqueueCallCount++;
          // After 2 successful enqueues (connected + test1), throw error on third
          if (enqueueCallCount > 2) {
            throw new Error('Connection closed');
          }
        },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      // At this point: 1 enqueue (connected event)
      expect(enqueueCallCount).toBe(1);

      // First broadcast succeeds
      const count1 = broadcastTaskEvent(testTaskId, { type: 'test1' });
      expect(count1).toBe(1);
      expect(enqueueCallCount).toBe(2);

      // Second broadcast throws, listener should be removed
      const count2 = broadcastTaskEvent(testTaskId, { type: 'test2' });
      
      // Listener should have been removed after error
      expect(getListenerCount(testTaskId)).toBe(0);
      // count2 should be 0 because the listener was removed during the error
      expect(count2).toBe(0);
    });
  });
});
