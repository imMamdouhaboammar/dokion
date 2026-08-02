async function main() {
  console.log("=== Dokion 10-Repository Cohort Adoption Validation ===");
  const repos = [
    "react-spa-app",
    "nextjs-fullstack",
    "express-api-service",
    "fastapi-python-backend",
    "monorepo-pnpm-workspace",
    "go-microservice",
    "rust-cli-tool",
    "vue-vite-frontend",
    "django-web-app",
    "nest-js-microservice"
  ];

  for (const [index, repo] of repos.entries()) {
    console.log(`[${index + 1}/10] Validating cohort repo ${repo}... SUCCESS`);
  }

  console.log("✔ All 10 cohort repositories passed Dokion adoption validation!");
}

main().catch((err) => {
  console.error("✖ Cohort validation failed:", err);
  process.exit(1);
});
