/**
 * Public Download API
 * Download latest generated files without authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tasks, projects } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'zip'; // 'zip' or 'json'
    
    const db = getDb();
    
    // Find task by public token
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.publicToken, token))
      .get();
    
    if (!task) {
      return NextResponse.json(
        { error: 'Invalid or expired download link' },
        { status: 404 }
      );
    }
    
    if (task.status !== 'success') {
      return NextResponse.json(
        { error: 'Generation not completed' },
        { status: 400 }
      );
    }
    
    if (!task.outputDir || !existsSync(task.outputDir)) {
      return NextResponse.json(
        { error: 'Files not available' },
        { status: 404 }
      );
    }
    
    // Update download count
    await db.update(tasks)
      .set({ downloadCount: (task.downloadCount || 0) + 1 })
      .where(eq(tasks.id, task.id));
    
    // Get project info
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .get();
    
    if (format === 'json') {
      // Return manifest and file list
      const outputFiles = task.outputFiles ? JSON.parse(task.outputFiles) : [];
      const manifest = {
        taskId: task.id,
        projectId: task.projectId,
        projectName: project?.name || 'Unknown',
        outputDir: task.outputDir,
        files: outputFiles,
        outputSize: task.outputSize,
        downloadCount: task.downloadCount,
        completedAt: task.completedAt?.toISOString(),
        downloadUrl: `/api/files/${task.id}/`,
      };
      
      return NextResponse.json(manifest);
    }
    
    // Create ZIP archive
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Add all files from output directory
    archive.directory(task.outputDir, false);
    
    // Create stream
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
        'Content-Disposition': `attachment; filename="${project?.name || 'api'}-types.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Public download error:', error);
    return NextResponse.json(
      { error: 'Failed to create download' },
      { status: 500 }
    );
  }
}
