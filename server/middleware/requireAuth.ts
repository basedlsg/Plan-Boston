import { Request, Response, NextFunction } from 'express';
import { Session } from 'express-session';

// Extend Express session with our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

/**
 * Middleware to check if a user is authenticated
 * 
 * Use this on routes that require authentication.
 * It checks for a valid user session and responds with 401 if not authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated through session
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  // User is authenticated, proceed to the next middleware/route handler
  next();
}

/**
 * Middleware to attach the current user to the request
 * 
 * This doesn't block the request if there's no user,
 * but provides the user info if available
 */
export function attachCurrentUser(req: Request, res: Response, next: NextFunction) {
  // If user is logged in, add their ID to the request for easy access
  if (req.session?.userId) {
    req.user = { id: req.session.userId };
  }
  
  next();
}

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}