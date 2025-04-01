/**
 * AI Admin Routes
 * 
 * This module provides admin API endpoints for viewing and analyzing AI logs.
 */

import { Express, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { aiInteractions } from './aiLogging';
import { count } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Register admin routes for AI analytics and debugging 
 */
function isAdmin(req: Request): boolean {
  // Check if user has admin role from Replit headers
  const roles = req.headers['x-replit-user-roles'];
  return roles?.includes('admin') || false;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

export function registerAiAdminRoutes(app: Express): void {
  // Get all AI logs (paginated, most recent first)
  app.get('/api/admin/ai-logs', requireAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = page * limit;
      
      // Use different queries for filterable endpoints
      const modelFilter = req.query.model ? 
        sql`model_name = ${req.query.model}` : 
        sql`1=1`;
      
      const statusFilter = req.query.status ? 
        sql`status = ${req.query.status}` : 
        sql`1=1`;
      
      // Fetch total count for pagination
      const totalCountResult = await db
        .select({ value: count() })
        .from(aiInteractions)
        .where(sql`${modelFilter} AND ${statusFilter}`);
      
      const totalCount = totalCountResult[0].value;
      
      // Fetch logs with pagination
      const logs = await db
        .select()
        .from(aiInteractions)
        .where(sql`${modelFilter} AND ${statusFilter}`)
        .orderBy(sql`timestamp DESC`)
        .limit(limit)
        .offset(offset);
      
      res.json({
        totalCount,
        page,
        limit,
        logs
      });
    } catch (error) {
      console.error('Error fetching AI logs:', error);
      res.status(500).json({ error: 'Failed to fetch AI logs' });
    }
  });
  
  // Get a specific log by ID
  app.get('/api/admin/ai-logs/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid log ID' });
      }
      
      const log = await db
        .select()
        .from(aiInteractions)
        .where(sql`id = ${id}`)
        .limit(1);
      
      if (log.length === 0) {
        return res.status(404).json({ error: 'Log not found' });
      }
      
      res.json(log[0]);
    } catch (error) {
      console.error('Error fetching AI log by ID:', error);
      res.status(500).json({ error: 'Failed to fetch AI log' });
    }
  });
  
  // Get all logs for a specific session
  app.get('/api/admin/ai-logs/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      
      const logs = await db
        .select()
        .from(aiInteractions)
        .where(sql`session_id = ${sessionId}`)
        .orderBy(sql`timestamp`);
      
      res.json({ logs, count: logs.length });
    } catch (error) {
      console.error('Error fetching AI logs by session:', error);
      res.status(500).json({ error: 'Failed to fetch AI logs' });
    }
  });
  
  // Get statistics about AI usage
  app.get('/api/admin/ai-stats', async (req: Request, res: Response) => {
    try {
      // Count by status
      const statusCounts = await db
        .select({
          status: aiInteractions.status,
          count: count()
        })
        .from(aiInteractions)
        .groupBy(aiInteractions.status);
      
      // Count by model
      const modelCounts = await db
        .select({
          model: aiInteractions.modelName,
          count: count()
        })
        .from(aiInteractions)
        .groupBy(aiInteractions.modelName);
      
      // Average processing time
      const avgProcessingTime = await db
        .select({
          avg: sql<number>`AVG(processing_time_ms)`
        })
        .from(aiInteractions)
        .where(sql`processing_time_ms IS NOT NULL`);
      
      // Count by day (last 7 days)
      const lastWeekLogs = await db
        .select({
          date: sql<string>`DATE(timestamp)`,
          count: count()
        })
        .from(aiInteractions)
        .where(sql`timestamp > NOW() - INTERVAL '7 days'`)
        .groupBy(sql`DATE(timestamp)`)
        .orderBy(sql`DATE(timestamp)`);
      
      res.json({
        statusCounts,
        modelCounts,
        averageProcessingTime: avgProcessingTime[0]?.avg || 0,
        lastWeekActivity: lastWeekLogs
      });
    } catch (error) {
      console.error('Error fetching AI statistics:', error);
      res.status(500).json({ error: 'Failed to fetch AI statistics' });
    }
  });
  
  // Download log file
  app.get('/api/admin/ai-logs/file', (req: Request, res: Response) => {
    try {
      const logPath = path.join('logs', 'ai-interactions.log');
      
      if (!fs.existsSync(logPath)) {
        return res.status(404).json({ error: 'Log file not found' });
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="ai-interactions.log"');
      
      const fileStream = fs.createReadStream(logPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error downloading log file:', error);
      res.status(500).json({ error: 'Failed to download log file' });
    }
  });
}