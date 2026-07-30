import { runCapabilityAudit, type CapabilityAuditReport } from '../../inspect/doctor';

export function handleDoctorCommand(): CapabilityAuditReport {
  return runCapabilityAudit();
}
