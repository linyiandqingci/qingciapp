// 清辞内核 · 统计查询接口（Cloudflare Pages Function）
// 路径: /api/stats  (GET)
// 依赖: KV 命名空间绑定，变量名 STATS_KV

function todayStr() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function shanghaiTime() {
  const t = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  return {
    date: t.slice(0, 10),
    time: t.slice(11, 19),
  };
}

function json(body) {
  return Response.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const kv = env.STATS_KV;
  const today = todayStr();
  const sh = shanghaiTime();

  // ---- 实时在线：o: 前缀下未过期的 key ----
  const onlineIps = [];
  let cursor;
  do {
    const list = await kv.list({ prefix: "o:", cursor });
    cursor = list.cursor;
    for (const k of list.keys) onlineIps.push(k.name.slice(2));
  } while (cursor);

  // ---- 今日明细：d:YYYY-MM-DD: 前缀 ----
  const dayMap = {};
  cursor = undefined;
  do {
    const list = await kv.list({ prefix: `d:${today}:`, cursor });
    cursor = list.cursor;
    for (const k of list.keys) {
      const ip = k.name.slice(`d:${today}:`.length);
      try {
        const val = await kv.get(k.name, "json");
        if (val) dayMap[ip] = val;
      } catch (e) {}
    }
  } while (cursor);

  const todayIps = Object.entries(dayMap)
    .map(([ip, info]) => ({
      ip,
      count: info.count || 0,
      last: new Date((info.last || 0) + 8 * 3600 * 1000)
        .toISOString()
        .slice(11, 19),
    }))
    .sort((a, b) => b.last.localeCompare(a.last));

  return json({
    server_time: `${sh.date} ${sh.time}`,
    today,
    online: onlineIps.length,
    online_ips: onlineIps,
    today_total: todayIps.reduce((sum, x) => sum + x.count, 0), // 今日使用人次
    today_unique: todayIps.length, // 今日独立 IP
    today_ips: todayIps,
  });
}
