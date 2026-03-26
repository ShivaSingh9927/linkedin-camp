import axios from 'axios';

export class LinkedInService {
  /**
   * Checks if the provided LinkedIn session cookie (li_at) is still valid.
   * This makes a lightweight request to the LinkedIn feed to verify.
   */
  static async isSessionValid(cookieString: string): Promise<boolean> {
    if (!cookieString) return false;

    // Use a simple HEAD or GET request to LinkedIn with the cookie
    try {
      const response = await axios.get('https://www.linkedin.com/feed/', {
        headers: {
          'Cookie': `li_at=${cookieString}`,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });
      
      // If we land on feed or get a 200, it's valid. 
      // Redirects to login would fail the validateStatus check or result in a different URL.
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
