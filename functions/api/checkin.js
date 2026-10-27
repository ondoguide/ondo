// ONDO 방문 인증: 손님 위치와 가게 좌표의 거리를 서버에서 계산하고, 결과만 저장합니다 (손님 좌표는 저장하지 않음).
// 필요한 설정 (Cloudflare Pages > Settings > Bindings): KV namespace 바인딩 이름 CHECKINS
const VENUES = {"v02": [35.156137, 129.124303, "민생주"], "v03": [35.15581, 129.12288, "새벽집"], "v04": [35.156232, 129.124231, "쿠치가"], "v05": [35.153234, 129.124656, "디에이블 광안점"], "v07": [35.1548, 129.1192, "다이린"], "v08": [35.157065, 129.121911, "야끼토리 로만"], "v10": [35.156681, 129.122375, "소년 광안본점"], "v11": [35.156442, 129.124786, "톤쇼우 광안점"], "v12": [35.153235, 129.124656, "프랭크커핀바 광안점"], "v13": [35.1572, 129.1215, "나가하마만게츠 광안리점"], "v14": [35.156786, 129.12521, "Etalee"], "v15": [35.156604, 129.125021, "고하순 광안직영점"], "v17": [35.1542, 129.1222, "부산항 먹태클럽"], "v18": [35.157551, 129.125805, "83해치"], "v19": [35.157226, 129.121724, "화륵"], "v22": [35.158482, 129.120384, "듀플릿"], "v24": [35.155809, 129.123036, "해성막창 광안리점"], "v25": [35.155376, 129.125142, "개미집 광안리점"], "v26": [35.154233, 129.126056, "나막집 광안민락점"], "v27": [35.157952, 129.125095, "좋은느낌포차"], "v28": [35.158146, 129.12486, "호이호이"], "v29": [35.156342, 129.122774, "돈까스의정원 광안본점"], "v32": [35.156073, 129.121272, "주청광장 광안점"], "v33": [35.15989, 129.120875, "외딴섬"], "v34": [35.155165, 129.121165, "까사부사노 테라스"]};
const RADIUS_M = 150;      // 가게 반경
const MAX_ACC_M = 200;     // 이보다 부정확한 위치는 다시 시도하게 함
const MAX_AGE_H = 48;      // 추천 후 이 시간 안에만 인증 가능

function dist(a, b, c, d) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLa = r(c - a), dLo = r(d - b);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const codeOf = r => r.slice(-4).toUpperCase();

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, why: 'bad' }, 400); }
  const r = String(b.r || ''), v = String(b.v || '');
  const lat = +b.lat, lng = +b.lng, acc = Math.max(0, +b.acc || 0);
  if (!/^r[0-9a-z]{8,16}$/.test(r) || !VENUES[v] || !isFinite(lat) || !isFinite(lng)) return json({ ok: false, why: 'bad' }, 400);
  const made = parseInt(r.slice(1, -4), 36);
  if (!isFinite(made) || Date.now() - made > MAX_AGE_H * 3600e3) return json({ ok: false, why: 'expired' });
  if (!env.CHECKINS) return json({ ok: false, why: 'setup' }, 500);
  const prev = await env.CHECKINS.get('c:' + r, 'json');
  if (prev && prev.ok) return json({ ok: true, again: true, name: VENUES[v][2], code: codeOf(r) });
  if (acc > MAX_ACC_M) return json({ ok: false, why: 'accuracy', acc: Math.round(acc) });
  const [vl, vg, name] = VENUES[v];
  const d = dist(lat, lng, vl, vg);
  const ok = d - Math.min(acc, 100) <= RADIUS_M;
  const rec = { r, v, name, ok, d: Math.round(d), acc: Math.round(acc), at: Date.now(), code: codeOf(r), tries: ((prev && prev.tries) || 0) + 1 };
  await env.CHECKINS.put('c:' + r, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 120 });
  return json(ok ? { ok: true, name, code: rec.code } : { ok: false, why: 'far', d: rec.d, name });
}
