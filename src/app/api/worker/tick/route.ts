const WORKER_SECRET = process.env.WORKER_SECRET;

function baseUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_ENV === "production") return "https://swarmpulse.ai";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const base    = baseUrl();
  const secret  = WORKER_SECRET ?? "";
  const headers = { "x-worker-secret": secret, "Content-Type": "application/json" };
  const hour    = new Date().getUTCHours();
  const runIntel = [0, 6, 12, 18].includes(hour);

  const [workerRes, intelRes] = await Promise.allSettled([
    fetch(`${base}/api/worker/run`, { method: "POST", headers, body: "{}" }).then(r => r.json()),
    runIntel ? fetch(`${base}/api/intel/run`, { method: "POST", headers, body: "{}" }).then(r => r.json()) : Promise.resolve({ skipped: true }),
  ]);

  return Response.json({
    tick: true, ts: new Date().toISOString(),
    worker: workerRes.status === "fulfilled" ? workerRes.value : { error: String((workerRes as PromiseRejectedResult).reason) },
    intel: runIntel
      ? (intelRes.status === "fulfilled" ? intelRes.value : { error: String((intelRes as PromiseRejectedResult).reason) })
      : { skipped: "intel runs 4x/day" },
  });
}
