/**
 * Task Processor API
 * Processes pending tasks in the background
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, tasks } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { TaskStatus } from '@/lib/db';
import { startTask } from '@/lib/tasks';

/**
 * POST /api/tasks/process
 * Process pending tasks
 * Body: { taskId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Get the task
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get();

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status !== TaskStatus.PENDING) {
      return NextResponse.json(
        { error: 'Task is not in pending status', status: task.status },
        { status: 400 }
      );
    }

    // Start the task
    const startResult = await startTask(taskId);

    if (!startResult.success) {
      return NextResponse.json(
        { error: startResult.error },
        { status: 500 }
      );
    }

    // Process the task asynchronously (don't await)
    processTask(taskId, task.projectId).catch(console.error);

    return NextResponse.json({
      success: true,
      task: startResult.task,
    });
  } catch (error) {
    console.error('Task processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process task' },
      { status: 500 }
    );
  }
}

/**
 * Process a task asynchronously
 */
async function processTask(taskId: string, projectId: number) {
  try {
    // Dynamic import to avoid circular dependencies
    const { generateTypes } = await import('@/lib/generator');
    
    await generateTypes({
      projectId,
      taskId,
      onProgress: async (message) => {
        try {
          const { appendTaskLog } = await import('@/lib/tasks');
          await appendTaskLog(taskId, message);
        } catch (e) {
          console.error('Failed to log progress:', e);
        }
      },
      onComplete: async (outputPath) => {
        console.log(`Task ${taskId} completed: ${outputPath}`);
      },
      onError: async (error) => {
        console.error(`Task ${taskId} failed:`, error);
      },
    });
  } catch (error) {
    console.error(`Task ${taskId} processing failed:`, error);
    try {
      const { failTask } = await import('@/lib/tasks');
      await failTask(taskId, error instanceof Error ? error.message : 'Unknown error');
    } catch (e) {
      console.error('Failed to mark task as failed:', e);
    }
  }
}

/**
 * GET /api/tasks/process/poll
 * Poll for pending tasks and process them (for background workers)
 */
export async function GET() {
  try {
    const db = getDb();

    // Get a pending task
    const pendingTask = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, TaskStatus.PENDING),
          isNull(tasks.startedAt)
        )
      )
      .limit(1)
      .get();

    if (!pendingTask) {
      return NextResponse.json({ message: 'No pending tasks', processed: 0 });
    }

    // Start processing
    const startResult = await startTask(pendingTask.id);

    if (!startResult.success) {
      return NextResponse.json(
        { error: startResult.error, taskId: pendingTask.id },
        { status: 500 }
      );
    }

    // Process asynchronously
    processTask(pendingTask.id, pendingTask.projectId).catch(console.error);

    return NextResponse.json({
      success: true,
      taskId: pendingTask.id,
    });
  } catch (error) {
    console.error('Poll error:', error);
    return NextResponse.json(
      { error: 'Failed to poll tasks' },
      { status: 500 }
    );
  }
}
