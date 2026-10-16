import "../src/config/env";
import { prisma } from "../src/config/database";
import { restoreDemoData } from "../src/utils/restoreDemoData";

async function main() {
  console.log("Starting canonical demo dataset restoration for ORG-001...");
  const result = await restoreDemoData(prisma, "ORG-001");
  console.log("Demo dataset restored successfully:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error("Failed to restore demo dataset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
