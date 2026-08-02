import { generateProductSurface } from "../src/catalog/product-surface.ts";

async function main() {
  const root = process.cwd();
  const surface = generateProductSurface(root);
  
  console.log("=== Dokion Product Surface Truth Verification ===");
  console.log(`Repository: ${surface.repository_url}`);
  console.log(`Version: ${surface.version}`);
  console.log(`Implemented Commands: ${surface.commands.filter((c) => c.status === "IMPLEMENTED").length}`);
  console.log(`Planned Commands: ${surface.commands.filter((c) => c.status === "PLANNED").length}`);
  console.log(`Supported Frameworks: ${surface.capabilities.frameworks.map((f) => f.id).join(", ")}`);
  
  if (surface.capabilities.total_skills_count === 0) {
    throw new Error("Product surface reported 0 total skills");
  }
  
  console.log("✔ Release truth verified successfully!");
}

main().catch((err) => {
  console.error("✖ Release truth verification failed:", err);
  process.exit(1);
});
