require("dotenv/config");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

(async () => {
  const conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  for (const name of ["monitor", "clip", "publish"]) {
    const q = new Queue(name, { connection: conn });
    const counts = await q.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );
    console.log("QUEUE", name, JSON.stringify(counts));
    const jobs = await q.getJobs(
      ["waiting", "active", "failed", "delayed"],
      0,
      20,
    );
    console.log(
      "JOBS",
      name,
      jobs.map((j) => ({
        id: j.id,
        name: j.name,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        data: j.data,
      })),
    );
    await q.close();
  }

  await conn.quit();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
