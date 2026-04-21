// Cloudflare Pages Function — OpenRouter proxy
// Route: POST /api/chat
// Env var OR_KEY set in: Pages project → Settings → Environment variables

export async function onRequestPost({ request, env }) {
  const userKey = request.headers.get('X-User-Key');
  const ownerKey = env.OR_KEY;
  const apiKey = (userKey && userKey.startsWith('sk-')) ? userKey : ownerKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'No API key configured on server.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://soulcaste.pages.dev',
      'X-Title': 'Soulcaste',
    },
    body: JSON.stringify(body),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
