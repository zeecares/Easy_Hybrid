// Simple test function to verify Functions are working
export async function onRequestGet() {
  return new Response('Hello from Cloudflare Pages Functions!', {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}