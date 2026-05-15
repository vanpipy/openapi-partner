/**
 * Task Download API
 * Download generated files as ZIP archive
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    
    // Get task
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
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
    
    if (!task.outputDir || !existsSync(task.outputDir)) {
      return NextResponse.json(
        { error: 'Output files not found' },
        { status: 404 }
      );
    }
    
    // Update download count
    await db.update(tasks)
      .set({ downloadCount: (task.downloadCount || 0) + 1 })
      .where(eq(tasks.id, id));
    
    // Use archiver with dynamic import
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Add all files from output directory
    archive.directory(task.outputDir, false);
    
    // Collect chunks
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    // Wait for archive to complete
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });
    
    const zipBuffer = Buffer.concat(chunks);
    
    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="task-${id}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to create download' },
      { status: 500 }
    );
  }
}
