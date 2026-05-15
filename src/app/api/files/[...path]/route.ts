/**
 * File Download API
 * Download individual generated files
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync, createReadStream } from 'fs';
import { join, extname } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    
    if (!path || path.length < 2) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    const taskId = path[0];
    const fileName = path.slice(1).join('/');
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'Filename required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Get task
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
    
    if (task.status !== 'success') {
      return NextResponse.json(
        { error: 'Task not completed' },
        { status: 400 }
      );
    }
    
    if (!task.outputDir) {
      return NextResponse.json(
        { error: 'Output directory not found' },
        { status: 404 }
      );
    }
    
    // Security: prevent path traversal
    if (fileName.includes('..') || fileName.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const filePath = join(task.outputDir, fileName);
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Determine content type
    const ext = extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.md': 'text/markdown',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Read and return file
    const { readFileSync } = await import('fs');
    const fileBuffer = readFileSync(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
