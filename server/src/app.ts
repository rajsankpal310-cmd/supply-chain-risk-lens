import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import apiRouter from "./routes/index";

const app = express();

app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev
      }
    },
    credentials: true,
  }),
);

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ extended: true, limit: "250mb" }));

// Health Check Endpoint
app.get("/health", async (_req, res) => {
  let dbStatus = "disconnected";
  let dbDetails: { version?: string; database?: string; provider?: string } | null = null;
  try {
    const { prisma } = await import("./config/database");
    const rawRes: any = await prisma.$queryRawUnsafe("SELECT version(), current_database();");
    dbStatus = "connected";
    dbDetails = {
      version: rawRes[0]?.version,
      database: rawRes[0]?.current_database,
      provider: "Supabase PostgreSQL",
    };
  } catch (_e) {
    dbStatus = "error";
  }

  const isHealthy = dbStatus === "connected";
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? "healthy" : "degraded",
    database: dbStatus,
    dbDetails,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Mount API Router
app.use("/api", apiRouter);

// Central Error Handler
app.use(errorHandler);

export default app;
