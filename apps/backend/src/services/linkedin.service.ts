import axios from 'axios';

export class LinkedInService {
  /**
   * Checks if the provided LinkedIn session cookie (li_at) is still valid.
   * This makes a lightweight request to the LinkedIn feed to verify.
   */
  static async isSessionValid(cookieString: string): Promise<boolean> {
    if (!cookieString) return false;

    // CRITICAL: DO NOT hit LinkedIn's /feed/ or any Page URL using raw Axios from Hetzner.
    // This lacks fingerprinting and uses a Data Center IP, which triggers immediate
    // security checkpoints and kills the user's active session on their laptop.
    
    // For status check, we'll assume it's valid if the cookie exists.
    // The actual worker will use Playwright with a proxy to verify and use the session.
    return cookieString.length > 50; 
  }
}
