import app from "./app";
import { env } from "./config/env";

const PORT = Number(env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` NEXUS-CFR REST API Server running on port ${PORT}`);
  console.log(` Environment: ${env.NODE_ENV}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(` API Base URL: http://localhost:${PORT}/api`);
  console.log(`==================================================`);
});
