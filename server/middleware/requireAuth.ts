import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Middleware to require authentication for protected routes
 * If user is not authenticated, redirects to login or returns 401
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check for Accept header to ensure proper response
  const acceptHeader = req.get('Accept');
  const wantsJSON = acceptHeader && acceptHeader.includes('application/json');
  
  if (!req.session || !req.session.userId) {
    if (wantsJSON) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource'
      });
    } else {
      return res.redirect('/login');
    }
  }
  
  next();
};

/**
 * Middleware to attach the current user to the request
 * This does not block the request if user is not authenticated
 */
export const attachCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    try {
      const user = await storage.getUserById(req.session.userId);
      
      if (user) {
        // Attach user to request object, excluding sensitive data
        req.currentUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url
        };
      }
    } catch (error) {
      console.error('Error attaching current user:', error);
      // Continue without attaching user
    }
  }
  
  next();
};