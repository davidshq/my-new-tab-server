import { Router } from 'itty-router';

// Create a new router
const router = Router();

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Google OAuth 2.0 configuration
const GOOGLE_OAUTH_CONFIG = {
  clientId: '', // Will be set via environment variable
  clientSecret: '', // Will be set via environment variable
  redirectUri: '', // Will be set via environment variable
  scopes: [
    'https://www.googleapis.com/auth/keep.readonly',
    'https://www.googleapis.com/auth/keep'
  ].join(' '),
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

// Google Keep API endpoints
const KEEP_API = {
  notes: 'https://keep.googleapis.com/v1/notes',
  labels: 'https://keep.googleapis.com/v1/labels',
};

// Handle CORS preflight requests
router.options('*', () => {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
});

// Health check endpoint
router.get('/health', () => {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: corsHeaders,
  });
});

// Start OAuth flow
router.get('/auth/google', async (request, env) => {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || crypto.randomUUID();
  
  // Store state for verification (in production, use KV store)
  const authUrl = new URL(GOOGLE_OAUTH_CONFIG.authUrl);
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_CONFIG.scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return new Response(JSON.stringify({ 
    authUrl: authUrl.toString(),
    state 
  }), {
    status: 200,
    headers: corsHeaders,
  });
});

// OAuth callback handler
router.get('/auth/callback', async (request, env) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // If this is a browser request (not API), serve the callback HTML
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    const callbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth Callback</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #ff6b6b;
            margin-top: 1rem;
        }
        .success {
            color: #51cf66;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div id="status">Processing authentication...</div>
    </div>

    <script>
        async function handleCallback() {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const error = urlParams.get('error');

            const statusElement = document.getElementById('status');

            if (error) {
                statusElement.textContent = 'Authentication failed: ' + error;
                statusElement.className = 'error';
                
                // Notify parent window of error
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'OAUTH_ERROR',
                        error: error
                    }, '*');
                }
                
                setTimeout(() => {
                    window.close();
                }, 3000);
                return;
            }

            if (!code) {
                statusElement.textContent = 'No authorization code received';
                statusElement.className = 'error';
                
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'OAUTH_ERROR',
                        error: 'No authorization code received'
                    }, '*');
                }
                
                setTimeout(() => {
                    window.close();
                }, 3000);
                return;
            }

            try {
                // Exchange code for tokens via our backend
                const response = await fetch('/auth/callback?' + window.location.search);
                const data = await response.json();

                if (data.success) {
                    statusElement.textContent = 'Authentication successful!';
                    statusElement.className = 'success';
                    
                    // Notify parent window of success
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'OAUTH_SUCCESS',
                            access_token: data.access_token,
                            refresh_token: data.refresh_token,
                            expires_in: data.expires_in,
                            user: data.user
                        }, '*');
                    }
                    
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Authentication failed');
                }
            } catch (error) {
                console.error('OAuth callback error:', error);
                statusElement.textContent = 'Authentication failed: ' + error.message;
                statusElement.className = 'error';
                
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'OAUTH_ERROR',
                        error: error.message
                    }, '*');
                }
                
                setTimeout(() => {
                    window.close();
                }, 3000);
            }
        }

        // Handle the callback when the page loads
        document.addEventListener('DOMContentLoaded', handleCallback);
    </script>
</body>
</html>`;

    return new Response(callbackHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }

  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!code) {
    return new Response(JSON.stringify({ error: 'No authorization code received' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: env.GOOGLE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch(GOOGLE_OAUTH_CONFIG.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // Return success response with tokens
    return new Response(JSON.stringify({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      user: userData,
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to complete OAuth flow',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

// Refresh access token
router.post('/auth/refresh', async (request, env) => {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'Refresh token required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();

    return new Response(JSON.stringify({
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to refresh token',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

// Google Keep API proxy endpoints
router.get('/api/keep/notes', async (request, env) => {
  const { searchParams } = new URL(request.url);
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Access token required' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const keepUrl = new URL(KEEP_API.notes);
    // Add query parameters from the request
    searchParams.forEach((value, key) => {
      keepUrl.searchParams.set(key, value);
    });

    const response = await fetch(keepUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Keep API error: ${response.status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Keep API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch Keep notes',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

router.get('/api/keep/labels', async (request, env) => {
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Access token required' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const response = await fetch(KEEP_API.labels, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Keep API error: ${response.status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Keep API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch Keep labels',
      details: error.message 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

// 404 handler
router.all('*', () => {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: corsHeaders,
  });
});

// Export the worker
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
}; 