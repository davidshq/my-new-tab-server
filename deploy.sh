#!/bin/bash

# My New Tab Server Deployment Script
# This script helps deploy the backend to Cloudflare Workers

set -e

echo "🚀 Deploying My New Tab Server to Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if environment variables are set
echo "🔍 Checking environment variables..."

if ! wrangler secret list | grep -q "GOOGLE_CLIENT_ID"; then
    echo "⚠️  GOOGLE_CLIENT_ID not set. Please set it with:"
    echo "wrangler secret put GOOGLE_CLIENT_ID"
    exit 1
fi

if ! wrangler secret list | grep -q "GOOGLE_CLIENT_SECRET"; then
    echo "⚠️  GOOGLE_CLIENT_SECRET not set. Please set it with:"
    echo "wrangler secret put GOOGLE_CLIENT_SECRET"
    exit 1
fi

if ! wrangler secret list | grep -q "GOOGLE_REDIRECT_URI"; then
    echo "⚠️  GOOGLE_REDIRECT_URI not set. Please set it with:"
    echo "wrangler secret put GOOGLE_REDIRECT_URI"
    exit 1
fi

echo "✅ Environment variables are set"

# Deploy to production
echo "🚀 Deploying to production..."
npm run deploy

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update the backendUrl in newtab.js to point to your worker URL"
echo "2. Test the OAuth flow by clicking the authenticate button in the Keep widget"
echo "3. Check the worker logs with: wrangler tail" 