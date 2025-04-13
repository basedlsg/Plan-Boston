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

/**
 * Get current URL information
 * GET /api/config/current-url
 * 
 * Diagnostic endpoint to help debug OAuth redirect issues
 */
router.get('/current-url', (req: Request, res: Response) => {
  const host = req.get('host') || 'unknown';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;
  
  res.json({
    baseUrl,
    host,
    protocol,
    fullUrl: `${baseUrl}${req.originalUrl}`,
    headers: req.headers,
    hostname: req.hostname
  });
});

export default router;