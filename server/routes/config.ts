import { Router, Request, Response } from 'express';
import { getApiKey } from '../config';

const router = Router();

/**
 * Get public configuration for the client
 * GET /api/config/public
 * 
 * Returns non-sensitive configuration values that the client needs
 */
router.get('/public', (req: Request, res: Response) => {
  const publicConfig = {
    googleClientId: getApiKey('GOOGLE_CLIENT_ID'),
    // Add other public configuration values as needed
  };
  
  res.json(publicConfig);
});

export default router;