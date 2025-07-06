# My New Tab Server

A simple Cloudflare Workers backend that handles OAuth 2.0 authentication for Google Keep API, allowing Chrome extensions to securely access Google Keep without exposing secrets.

## Features

- OAuth 2.0 flow for Google Keep API
- Token refresh handling
- Google Keep API proxy endpoints
- CORS support for Chrome extensions
- Simple deployment to Cloudflare Workers

## Setup

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Keep API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Keep API"
   - Click on it and press "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add your redirect URI: `https://your-worker-url.workers.dev/auth/callback`
   - Note down your Client ID and Client Secret

### 2. Cloudflare Workers Setup

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set environment variables:
   ```bash
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put GOOGLE_REDIRECT_URI
   ```

   When prompted, enter:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `GOOGLE_REDIRECT_URI`: `https://your-worker-url.workers.dev/auth/callback`

5. Deploy the worker:
   ```bash
   npm run deploy
   ```

### 3. Update Chrome Extension

1. Update the `backendUrl` in `newtab.js`:
   ```javascript
   this.backendUrl = 'https://your-worker-url.workers.dev';
   ```

2. Update your `manifest.template.json` to include the backend URL in permissions if needed.

## API Endpoints

### Authentication

- `GET /auth/google` - Start OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/refresh` - Refresh access token

### Google Keep API

- `GET /api/keep/notes` - Get Keep notes
- `GET /api/keep/labels` - Get Keep labels

## Development

### Local Development

```bash
npm run dev
```

This will start a local development server at `http://localhost:8787`.

### Environment Variables

The following environment variables are required:

- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
- `GOOGLE_REDIRECT_URI`: Your OAuth redirect URI

## Security Considerations

1. **Client Secrets**: Never expose client secrets in the Chrome extension. They are stored securely in Cloudflare Workers environment variables.

2. **Token Storage**: Access tokens are stored in Chrome's sync storage and are automatically refreshed when needed.

3. **CORS**: The backend includes proper CORS headers for Chrome extension communication.

4. **HTTPS**: All communication is over HTTPS, ensuring secure token transmission.

## Troubleshooting

### Common Issues

1. **OAuth Error**: Make sure your redirect URI matches exactly in Google Cloud Console
2. **CORS Errors**: Ensure the backend URL is correctly set in the extension
3. **Token Refresh Fails**: Check that the refresh token is being stored correctly

### Debugging

1. Check Cloudflare Workers logs:
   ```bash
   wrangler tail
   ```

2. Check Chrome extension console for authentication errors

3. Verify environment variables are set:
   ```bash
   wrangler secret list
   ```

## Architecture

```
Chrome Extension ←→ Cloudflare Workers ←→ Google APIs
     (GIS)              (OAuth 2.0)        (Calendar/Keep)
```

- **Calendar**: Uses Chrome's Identity API (GIS) directly
- **Keep**: Uses OAuth 2.0 flow through the backend server

This architecture allows the extension to access both Calendar (via GIS) and Keep (via OAuth 2.0) while keeping secrets secure. 