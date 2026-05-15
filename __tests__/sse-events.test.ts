/**
 * Tests for SSE Event System
 * Verifies that task events are broadcast to connected clients
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
  cleanupStaleListeners,
} from '@/lib/events';

describe('SSE Event System', () => {
  let db: ReturnType<typeof getDb>;
  let testProjectId: number;
  let testTaskId: string;

  beforeAll(async () => {
    db = getDb();
    await db.run(sql`DELETE FROM tasks`);
    await db.run(sql`DELETE FROM tokens`);
    await db.run(sql`DELETE FROM projects`);

    const [project] = await db
      .insert(projects)
      .values({
        name: 'SSE Event Test Project',
        specUrl: 'https://api.example.com/openapi.json',
        specType: SpecType.OPENAPI_3X,
        isActive: true,
      })
      .returning();
    
    testProjectId = project.id;

    const [task] = await db
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        projectId: testProjectId,
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

  beforeEach(async () => {
    // Clean up all listeners before each test
    cleanupStaleListeners(0);
  });

  describe('addTaskListener', () => {
    it('should add a listener for a task', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const listenerId = addTaskListener(testTaskId, mockController);
      expect(listenerId).toBeTruthy();
      expect(typeof listenerId).toBe('string');

      // Cleanup
      removeTaskListener(listenerId);
    });

    it('should return unique IDs for each listener', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener(testTaskId, mockController);
      const id2 = addTaskListener(testTaskId, mockController);

      expect(id1).not.toBe(id2);

      // Cleanup
      removeTaskListener(id1);
      removeTaskListener(id2);
    });

    it('should send initial connected event', () => {
      let receivedData = '';
      const mockController = {
        enqueue: (data: string) => { receivedData = data; },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const listenerId = addTaskListener(testTaskId, mockController);

      expect(receivedData).toContain('connected');
      expect(receivedData).toContain(testTaskId);

      // Cleanup
      removeTaskListener(listenerId);
    });
  });

  describe('removeTaskListener', () => {
    it('should remove a listener', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const listenerId = addTaskListener(testTaskId, mockController);
      expect(getListenerCount(testTaskId)).toBe(1);

      removeTaskListener(listenerId);
      expect(getListenerCount(testTaskId)).toBe(0);
    });

    it('should handle removing non-existent listener', () => {
      expect(() => removeTaskListener('non-existent-id')).not.toThrow();
    });
  });

  describe('broadcastTaskEvent', () => {
    it('should send event to all listeners of a task', () => {
      let receivedEvents: string[] = [];
      
      const mockController1 = {
        enqueue: (data: string) => { receivedEvents.push(data + '_1'); },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const mockController2 = {
        enqueue: (data: string) => { receivedEvents.push(data + '_2'); },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id1 = addTaskListener(testTaskId, mockController1);
      const id2 = addTaskListener(testTaskId, mockController2);

      // Clear events from initial connection
      receivedEvents = [];

      broadcastTaskEvent(testTaskId, { type: 'started', status: 'PROCESSING' });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0]).toContain('started');
      expect(receivedEvents[1]).toContain('started');

      // Cleanup
      removeTaskListener(id1);
      removeTaskListener(id2);
    });

    it('should only send to listeners of the specific task', () => {
      const otherTaskId = 'other-task-id';
      let receivedEvents: string[] = [];
      
      const mockController = {
        enqueue: (data: string) => { receivedEvents.push(data); },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(otherTaskId, mockController);

      // Clear events from initial connection
      receivedEvents = [];

      // Broadcast to different task
      broadcastTaskEvent(testTaskId, { type: 'started' });

      expect(receivedEvents).toHaveLength(0);

      // Cleanup
      removeTaskListener(id);
    });

    it('should include taskId in broadcast event', () => {
      let receivedData = '';
      
      const mockController = {
        enqueue: (data: string) => { receivedData = data; },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      broadcastTaskEvent(testTaskId, { type: 'completed', status: 'SUCCESS' });

      expect(receivedData).toContain(testTaskId);

      // Cleanup
      removeTaskListener(id);
    });

    it('should include timestamp in broadcast event', () => {
      let receivedData = '';
      
      const mockController = {
        enqueue: (data: string) => { receivedData = data; },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      broadcastTaskEvent(testTaskId, { type: 'progress', message: 'Working...' });

      expect(receivedData).toContain('timestamp');

      // Cleanup
      removeTaskListener(id);
    });

    it('should include custom data in broadcast event', () => {
      let receivedData = '';
      
      const mockController = {
        enqueue: (data: string) => { receivedData = data; },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      broadcastTaskEvent(testTaskId, {
        type: 'completed',
        status: 'SUCCESS',
        outputPath: '/tmp/generated',
        outputSize: 1024,
      });

      expect(receivedData).toContain('/tmp/generated');
      expect(receivedData).toContain('1024');

      // Cleanup
      removeTaskListener(id);
    });

    it('should handle failed event with error message', () => {
      let receivedData = '';
      
      const mockController = {
        enqueue: (data: string) => { receivedData = data; },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      broadcastTaskEvent(testTaskId, {
        type: 'failed',
        status: 'FAILED',
        errorMessage: 'Network timeout',
      });

      expect(receivedData).toContain('failed');
      expect(receivedData).toContain('Network timeout');

      // Cleanup
      removeTaskListener(id);
    });
  });

  describe('getListenerCount', () => {
    it('should return 0 for task with no listeners', () => {
      const count = getListenerCount('no-such-task');
      expect(count).toBe(0);
    });

    it('should return correct count for task with listeners', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const uniqueTaskId = `task-${crypto.randomUUID()}`;
      
      const id1 = addTaskListener(uniqueTaskId, mockController);
      const id2 = addTaskListener(uniqueTaskId, mockController);
      const id3 = addTaskListener(uniqueTaskId, mockController);

      expect(getListenerCount(uniqueTaskId)).toBe(3);

      // Cleanup
      removeTaskListener(id1);
      removeTaskListener(id2);
      removeTaskListener(id3);
    });
  });

  describe('cleanupStaleListeners', () => {
    it('should remove listeners older than maxAge', async () => {
      // Don't rely on beforeEach cleanup - manually clean first
      cleanupStaleListeners(0);
      
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const uniqueTaskId = `task-${crypto.randomUUID()}`;
      const id = addTaskListener(uniqueTaskId, mockController);

      expect(getListenerCount(uniqueTaskId)).toBe(1);

      // Cleanup with 0ms maxAge should remove all
      const cleaned = cleanupStaleListeners(0);
      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(getListenerCount(uniqueTaskId)).toBe(0);
    });

    it('should not remove recent listeners', () => {
      const mockController = {
        enqueue: () => {},
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const uniqueTaskId = `task-${crypto.randomUUID()}`;
      addTaskListener(uniqueTaskId, mockController);

      // Cleanup with large maxAge should not remove
      cleanupStaleListeners(60000);
      expect(getListenerCount(uniqueTaskId)).toBe(1);
      
      // Clean up after test
      cleanupStaleListeners(0);
    });
  });

  describe('Event Flow Integration', () => {
    it('should support complete task lifecycle events', () => {
      let events: string[] = [];
      
      const mockController = {
        enqueue: (data: string) => { events.push(data); },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      // Simulate task lifecycle
      broadcastTaskEvent(testTaskId, { type: 'init', status: 'PENDING' });
      broadcastTaskEvent(testTaskId, { type: 'started', status: 'PROCESSING' });
      broadcastTaskEvent(testTaskId, { type: 'progress', message: 'Generating types...' });
      broadcastTaskEvent(testTaskId, { type: 'completed', status: 'SUCCESS' });

      expect(events).toHaveLength(5); // 1 init + 4 lifecycle events
      expect(events.some(e => e.includes('init'))).toBe(true);
      expect(events.some(e => e.includes('started'))).toBe(true);
      expect(events.some(e => e.includes('progress'))).toBe(true);
      expect(events.some(e => e.includes('completed'))).toBe(true);

      // Cleanup
      removeTaskListener(id);
    });

    it('should support failed task lifecycle events', () => {
      let events: string[] = [];
      
      const mockController = {
        enqueue: (data: string) => { events.push(data); },
        close: () => {},
      } as unknown as ReadableStreamDefaultController;

      const id = addTaskListener(testTaskId, mockController);

      // Clear events from initial connection
      events = [];

      // Simulate failed task lifecycle
      broadcastTaskEvent(testTaskId, { type: 'init', status: 'PENDING' });
      broadcastTaskEvent(testTaskId, { type: 'started', status: 'PROCESSING' });
      broadcastTaskEvent(testTaskId, { type: 'failed', status: 'FAILED', errorMessage: 'Spec not found' });

      expect(events).toHaveLength(3);
      expect(events.some(e => e.includes('failed'))).toBe(true);
      expect(events.some(e => e.includes('Spec not found'))).toBe(true);

      // Cleanup
      removeTaskListener(id);
    });
  });
});
