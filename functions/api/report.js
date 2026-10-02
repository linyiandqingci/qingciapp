// 清辞内核 · 使用上报接口（Cloudflare Pages Function）
// 路径: /api/report  (POST)
// 依赖: KV 命名空间绑定，变量名 STATS_KV

const KV = (env) => env.STATS_KV;

// Asia/Shanghai 时区的今天日期 YYYY-MM-DD
function todayStr() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = KV(env);

  // 读取请求体（扩展字段预留，读取失败不影响）
  try {
    const len = request.headers.get("Content-Length");
    if (len && Number(len) > 0) await request.text();
  } catch (e) {}

  // 真实客户端 IP：Cloudflare 自动注入
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const today = todayStr();

  // 1) 今日汇总 key：d:2026-10-02:1.2.3.4 -> {count, last}
  const dayKey = `d:${today}:${ip}`;
  let info = { count: 0, last: 0 };
  try {
    const existing = await kv.get(dayKey, "json");
    if (existing) info = existing;
  } catch (e) {}
  info.count += 1;
  info.last = now;
  await kv.put(dayKey, JSON.stringify(info));

  // 2) 在线 key：o:1.2.3.4 -> 最近活跃时间，5 分钟自动过期
  await kv.put(`o:${ip}`, String(now), { expirationTtl: 300 });

  return json({ ok: true, ip });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
