import { Request, Response, Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { insertLocalUserSchema, loginSchema, googleAuthSchema, insertGoogleUserSchema } from '@shared/schema';
import { attachCurrentUser } from '../middleware/requireAuth';
import { SessionData } from 'express-session';
import { storage } from '../storage';

// Create a router for authentication routes
const router = Router();

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body against the schema
    const validation = insertLocalUserSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.format() 
      });
    }
    
    const { email, password, name } = validation.data;
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Create new user
    const user = await storage.createLocalUser(
      { email, name, password, confirmPassword: password }, 
      password_hash
    );
      
    // Set user ID in session
    req.session.userId = user.id;
    
    // Return user without password hash
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while registering user'
    });
  }
});

/**
 * Login a user
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.format() 
      });
    }
    
    const { email, password } = validation.data;
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }
    
    // Check if this is a local auth account
    if (!user.password_hash || user.auth_provider !== 'local') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Please use the appropriate login method for this account'
      });
    }
    
    // Compare password with hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash || '');
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }
    
    // Set user ID in session
    req.session.userId = user.id;
    
    // Return user without password hash
    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while processing login'
    });
  }
});

/**
 * Logout a user
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  // Destroy session
  req.session.destroy((err: Error | null) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ 
        error: 'Server error',
        message: 'An error occurred while logging out'
      });
    }
    
    // Clear cookie
    res.clearCookie('connect.sid');
    
    return res.json({
      message: 'Logout successful'
    });
  });
});

/**
 * Get current user status
 * GET /api/auth/status
 */
router.get('/status', attachCurrentUser, async (req: Request, res: Response) => {
  try {
    // If no user is logged in
    if (!req.session.userId) {
      return res.json({
        loggedIn: false
      });
    }
    
    // Find user details
    const user = await storage.getUserById(req.session.userId);
    
    if (!user) {
      // Session exists but user doesn't - clear session
      req.session.destroy((err: Error | null) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
      return res.json({
        loggedIn: false
      });
    }
    
    // Return user status and data
    return res.json({
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while fetching authentication status'
    });
  }
});

/**
 * Authenticate with Google
 * POST /api/auth/google
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = googleAuthSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.format() 
      });
    }
    
    const { token } = validation.data;
    
    try {
      // Verify the Google token
      const { verifyGoogleToken } = await import('../lib/googleAuth');
      const googleUserInfo = await verifyGoogleToken(token);
      
      // Check if user exists by Google ID
      let user = await storage.getUserByGoogleId(googleUserInfo.sub);
      
      if (!user) {
        // Check if user exists by email
        user = await storage.getUserByEmail(googleUserInfo.email);
        
        if (user) {
          // If user exists but hasn't used Google auth before
          if (user.auth_provider === 'local') {
            return res.status(409).json({
              error: 'Authentication conflict',
              message: 'An account with this email already exists. Please log in with your password.'
            });
          }
        } else {
          // Create new user with Google info
          user = await storage.createGoogleUser({
            email: googleUserInfo.email,
            name: googleUserInfo.name,
            google_id: googleUserInfo.sub,
            avatar_url: googleUserInfo.picture,
            auth_provider: 'google'
          });
        }
      }
      
      // Set user ID in session
      req.session.userId = user.id;
      
      // Return user info
      return res.json({
        message: 'Google authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url
        }
      });
    } catch (error) {
      console.error('Error verifying Google token:', error);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Could not verify Google authentication'
      });
    }
  } catch (error) {
    console.error('Error with Google authentication:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during Google authentication'
    });
  }
});

export default router;