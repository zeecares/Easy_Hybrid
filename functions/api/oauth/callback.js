// Cloudflare Pages Function for GitHub OAuth token exchange
// This function handles the server-side token exchange that can't be done from the browser
// Handle CORS preflight requests
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
export async function onRequestPost(context) {
    const { request, env } = context;
    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    try {
        const { code, client_id, redirect_uri } = await request.json();
        if (!code || !client_id || !redirect_uri) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Easy-Hybrid-App',
            },
            body: new URLSearchParams({
                client_id,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri,
            }),
        });
        if (!tokenResponse.ok) {
            throw new Error(`GitHub API error: ${tokenResponse.status}`);
        }
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            return new Response(JSON.stringify({
                error: tokenData.error_description || tokenData.error
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({
            access_token: tokenData.access_token
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        console.error('OAuth token exchange failed:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Token exchange failed'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
