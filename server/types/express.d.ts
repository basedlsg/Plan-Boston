import 'express';

declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        email: string;
        name: string;
        avatar_url?: string;
      };
    }
  }
}

// Declaration merging for express-session
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}