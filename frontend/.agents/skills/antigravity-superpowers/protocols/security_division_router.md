# 🛡️ Protocol 10: Security Division Router & Specialization Matrix

## 1. Overview
The global system skills directory (`~/.gemini/config/skills/`) contains 12 specialized Security Division roles (`security-*`). This protocol establishes how Antigravity routes and delegates security auditing, threat modeling, and vulnerability remediation tasks across all projects.

## 2. Specialization Matrix & Role Mapping

### 🔍 Code Auditing & Application Security
- `security-ai-generated-code-auditor`: Hunts hardcoded secrets, prompt injections, broken RLS, and OWASP Top 10 vulnerabilities in AI-generated code.
- `security-appsec-engineer`: Threat modeling, SAST/DAST integration, secure code review, and SDLC security guardrails.
- `security-architect`: Zero-trust architecture, cryptographic protocols, defense-in-depth, security boundary design.
- `security-secrets-credential-engineer`: Credential hygiene, secret scanning, vault management, rotation policies.

### ☁️ Cloud, Compliance & Infrastructure Security
- `security-cloud-security-architect`: IAM policies, AWS/GCP/Azure zero-trust architecture, IaC security scanning.
- `security-compliance-auditor`: Technical compliance audits (SOC 2, ISO 27001, HIPAA, PCI-DSS) and evidence collection.
- `security-senior-secops`: SecOps, security automation, log auditing, vulnerability management.

### ⚔️ Offensive Security, Incident Response & Intelligence
- `security-penetration-tester`: Authorized penetration testing, web/network exploit analysis, vulnerability assessments.
- `security-incident-responder`: Forensics, breach containment, incident triage, and post-mortem root cause analysis.
- `security-threat-detection-engineer`: SIEM rule development, MITRE ATT&CK coverage, alert tuning, detection-as-code.
- `security-threat-intelligence-analyst`: Threat actor tracking, campaign mapping, adversary TTP analysis.
- `security-blockchain-security-auditor`: EVM smart contract auditing, reentrancy detection, DeFi protocol security.

## 3. Security Execution Workflow
1. **Threat Classification**: Assess whether the task involves code changes, authentication, credentials, cloud infra, or compliance.
2. **Specialized Auditor Selection**: Dispatch subagents using `invoke_subagent` with the selected `security-*` role.
3. **Rescan & Remediate Loop**: Scan, fix root causes, and rescan until all critical and high findings are remediated.
