/**
 * Cloudflare Worker — Claude API CORS proxy for Shayari Workshop
 *
 * Deploy this file to Cloudflare Workers (free tier).
 * See README.md for step-by-step instructions.
 *
 * What it does:
 *  - Receives POST requests from the browser (which can't call Claude directly due to CORS)
 *  - Forwards the request to api.anthropic.com with the user's API key
 *  - Returns the response with CORS headers so the browser accepts it
 */

const ALLOWED_ORIGIN = '*'; // Restrict to your GitHub Pages URL in production if desired
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return json({ error: 'Missing x-api-key header' }, 400);
    }

    let body;
    try {
      body = await request.text();
      JSON.parse(body); // validate it's JSON before forwarding
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    let claudeRes;
    try {
      claudeRes = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
        },
        body,
      });
    } catch (err) {
      return json({ error: `Upstream fetch failed: ${err.message}` }, 502);
    }

    const responseBody = await claudeRes.text();

    return new Response(responseBody, {
      status:  claudeRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
