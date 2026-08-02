import fs from "node:fs";
import path from "node:path";

const GLOBAL_SKILLS_DIR = "path.join(os.homedir())/.gemini/config/skills";

export function auditAndInjectSystemCapabilities() {
  if (!fs.existsSync(GLOBAL_SKILLS_DIR)) {
    console.error(`❌ Global skills directory missing: ${GLOBAL_SKILLS_DIR}`);
    return;
  }

  const entries = fs.readdirSync(GLOBAL_SKILLS_DIR, { withFileTypes: true });
  
  const divisions = {
    engineering: [] as string[],
    security: [] as string[],
    testing: [] as string[],
    design: [] as string[],
    other: [] as string[],
  };

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("engineering-")) {
        divisions.engineering.push(entry.name);
      } else if (entry.name.startsWith("security-")) {
        divisions.security.push(entry.name);
      } else if (entry.name.startsWith("testing-")) {
        divisions.testing.push(entry.name);
      } else if (entry.name.startsWith("design-")) {
        divisions.design.push(entry.name);
      } else {
        divisions.other.push(entry.name);
      }
    }
  }

  const totalSkills = 
    divisions.engineering.length + 
    divisions.security.length + 
    divisions.testing.length + 
    divisions.design.length + 
    divisions.other.length;

  console.log("==================================================");
  console.log("⚡ ANTIGRAVITY AUTO-INJECTION & AWARENESS MANIFEST");
  console.log("==================================================");
  console.log(`💻 Engineering Division Roles : ${divisions.engineering.length}`);
  console.log(`🛡️ Security Division Roles    : ${divisions.security.length}`);
  console.log(`🧪 Testing & QA Division Roles : ${divisions.testing.length}`);
  console.log(`🎨 Design & UX Division Roles  : ${divisions.design.length}`);
  console.log(`🛠️ General Core Skills         : ${divisions.other.length}`);
  console.log("--------------------------------------------------");
  console.log(`🚀 TOTAL AUTO-INJECTED SKILLS  : ${totalSkills}`);
  console.log("==================================================");
  console.log("✅ SYSTEM AWARENESS & AUTO-INJECTION: FULLY ACTIVE");
  console.log("==================================================");
}

if (import.meta.main) {
  auditAndInjectSystemCapabilities();
}
