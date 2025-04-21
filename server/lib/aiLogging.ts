/**
 * AI Logging System
 * 
 * This module provides comprehensive logging for AI interactions in the NYC Day Planner.
 * It captures queries, responses, processing times, and contextual information
 * to help with debugging, analysis, and optimization.
 */

import { db } from '../db';
import { pgTable, serial, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'ai-interaction-logger' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'ai-interactions.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Define the AI interactions table schema
export const aiInteractions = pgTable("ai_interactions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  userQuery: text("user_query").notNull(),
  modelName: text("model_name").notNull(),
  rawRequest: jsonb("raw_request"),
  rawResponse: text("raw_response"),
  parsedResponse: jsonb("parsed_response"),
  processingTimeMs: integer("processing_time_ms"),
  status: text("status").notNull(),
  errorDetails: text("error_details"),
  parameters: jsonb("parameters"),
  metaData: jsonb("meta_data")
});

// Create a schema for inserting data
export const insertAiInteractionSchema = createInsertSchema(aiInteractions).omit({ 
  id: true 
});

export type AiInteraction = typeof aiInteractions.$inferSelect;
export type InsertAiInteraction = z.infer<typeof insertAiInteractionSchema>;

/**
 * Log AI interaction to both file and database (if available)
 */
export async function logAiInteraction(data: {
  sessionId: string;
  userQuery: string;
  modelName: string;
  rawRequest?: any;
  rawResponse?: string;
  parsedResponse?: any;
  processingTimeMs?: number;
  status: 'success' | 'error' | 'warning';
  errorDetails?: string;
  parameters?: Record<string, any>;
  metaData?: Record<string, any>;
}): Promise<void> {
  try {
    // Add timestamp if not provided
    const logData = {
      ...data,
      timestamp: new Date()
    };
    
    // Log to Winston
    logger.info('AI Interaction', logData);
    
    // Insert into database
    try {
      await db.insert(aiInteractions).values({
        sessionId: data.sessionId,
        userQuery: data.userQuery,
        modelName: data.modelName,
        rawRequest: data.rawRequest ? data.rawRequest : null,
        rawResponse: data.rawResponse || null,
        parsedResponse: data.parsedResponse ? data.parsedResponse : null,
        processingTimeMs: data.processingTimeMs || null,
        status: data.status,
        errorDetails: data.errorDetails || null,
        parameters: data.parameters ? data.parameters : null,
        metaData: data.metaData ? data.metaData : null
      });
    } catch (dbError) {
      console.error('Failed to log AI interaction to database:', dbError);
      // Continue execution even if database insert fails
    }
  } catch (error) {
    console.error('Error in AI logging:', error);
  }
}

/**
 * Create a session ID for tracking interactions in a conversation
 */
export function generateSessionId(): string {
  return uuidv4();
}

/**
 * Create wrapper for Gemini API calls to automatically log interactions
 */
export function withAiLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    modelName: string;
    extractQuery: (args: Parameters<T>) => string;
    sessionIdGenerator?: () => string;
  }
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = Date.now();
    const sessionId = options.sessionIdGenerator ? options.sessionIdGenerator() : generateSessionId();
    const query = options.extractQuery(args);
    
    try {
      const result = await fn(...args);
      
      // Log successful interaction
      await logAiInteraction({
        sessionId,
        userQuery: query,
        modelName: options.modelName,
        rawRequest: args,
        parsedResponse: result,
        processingTimeMs: Date.now() - startTime,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      // Log failed interaction
      await logAiInteraction({
        sessionId,
        userQuery: query,
        modelName: options.modelName,
        rawRequest: args,
        processingTimeMs: Date.now() - startTime,
        status: 'error',
        errorDetails: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  };
}