import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * Get all itineraries for the current user
 * GET /api/itineraries/user
 */
router.get('/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access your itineraries'
      });
    }
    
    console.log(`Fetching itineraries for user ID: ${userId}`);
    const itineraries = await storage.getUserItineraries(userId);
    console.log(`Found ${itineraries.length} itineraries`);
    
    // Format the itineraries for the frontend, handle type safety
    const formattedItineraries = itineraries.map(itinerary => {
      // Ensure we have valid data with fallbacks for any potentially missing fields
      return {
        id: itinerary.id,
        title: `NYC Itinerary ${itinerary.id}`,
        query: itinerary.query || 'NYC Itinerary',
        created_at: itinerary.created?.toISOString() || new Date().toISOString(),
      };
    });
    
    // Return the itineraries, sorted by creation date (newest first)
    const sortedItineraries = formattedItineraries.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    console.log('Returning formatted itineraries:', sortedItineraries);
    return res.json(sortedItineraries);
  } catch (error) {
    console.error('Error fetching user itineraries:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching itineraries'
    });
  }
});

/**
 * Get a specific itinerary by ID
 * GET /api/itineraries/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Itinerary ID must be a number'
      });
    }
    
    const itinerary = await storage.getItinerary(id);
    
    if (!itinerary) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Itinerary not found'
      });
    }
    
    // We need to check user permissions later when we associate itineraries with users
    // For now, all itineraries are public
    
    return res.json({
      ...itinerary,
      created_at: itinerary.created?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching the itinerary'
    });
  }
});

export default router;