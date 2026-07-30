import { runDoctorAudit, type DoctorAuditReport } from "../../inspect/doctor.ts";

export async function handleDoctorCommand(root = process.cwd()): Promise<DoctorAuditReport> {
  return runDoctorAudit(root);
}
