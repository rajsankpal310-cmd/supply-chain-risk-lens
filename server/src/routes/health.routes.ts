import { Router } from "express";
import { prisma } from "../config/database";
import { env } from "../config/env";

const router = Router();

router.get("/", async (_req, res) => {
  let dbStatus = "disconnected";
  let latencyMs = 0;
  let dbDetails: { version?: string; database?: string; provider?: string } | null = null;
  const start = Date.now();
  try {
    const rawRes: any = await prisma.$queryRawUnsafe("SELECT version(), current_database();");
    dbStatus = "connected";
    latencyMs = Date.now() - start;
    dbDetails = {
      version: rawRes[0]?.version,
      database: rawRes[0]?.current_database,
      provider: "Supabase PostgreSQL",
    };
  } catch (_error) {
    dbStatus = "error";
  }

  const isHealthy = dbStatus === "connected";
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    database: dbStatus,
    latencyMs,
    environment: env.NODE_ENV,
    dbDetails,
    timestamp: new Date().toISOString(),
  });
});

export default router;
