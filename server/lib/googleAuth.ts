import { OAuth2Client } from 'google-auth-library';

// Create a Google OAuth client
// In a production environment, you would specify your clientId
const client = new OAuth2Client();

export interface GoogleUserInfo {
  email: string;
  name: string;
  sub: string; // This is the Google user ID
  picture?: string;
}

/**
 * Verify a Google ID token and extract user information
 * 
 * @param token The Google ID token to verify
 * @returns The verified user information from Google
 * @throws Error if the token is invalid
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUserInfo> {
  try {
    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      // In production, specify your clientId here
      // audience: process.env.GOOGLE_CLIENT_ID,
    });

    // Get the payload from the verified token
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Could not get payload from Google token');
    }

    if (!payload.email || !payload.sub) {
      throw new Error('Token does not contain required user information');
    }

    // Return the user information we need
    return {
      email: payload.email,
      name: payload.name || '',
      sub: payload.sub,
      picture: payload.picture
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    throw new Error('Failed to verify Google token');
  }
}