// 인증 목록 (본부용). 필요한 설정: 환경 변수 ADMIN_KEY (아무 긴 문자열), KV 바인딩 CHECKINS
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return new Response('forbidden', { status: 403 });
  const out = [];
  let cursor;
  do {
    const page = await env.CHECKINS.list({ prefix: 'c:', cursor });
    for (const k of page.keys) { const v = await env.CHECKINS.get(k.name, 'json'); if (v) out.push(v); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  out.sort((a, b) => b.at - a.at);
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
