# Dokion Playbooks Marketplace Moderation Policy

## Release Lifecycle States
1. `Draft`: Local or creator working state.
2. `Uploaded`: Package archive received and stored.
3. `Validating`: Automated security and test pipeline active.
4. `Validation Failed`: Automated checks failed; details provided to creator.
5. `Ready for Submission`: Automated checks passed; creator ready to submit.
6. `Submitted`: Queued for moderator review.
7. `Under Review`: Moderator inspecting package details, diffs, and findings.
8. `Changes Requested`: Feedback provided to creator for resubmission.
9. `Approved`: Submission verified and accepted by moderator.
10. `Published`: Publicly discoverable and installable/purchasable.
11. `Suspended`: Temporarily or permanently disabled due to security/policy flags.
12. `Deprecated`: Creator marked version as superseded.
13. `Archived`: Retained for audit and historical record.

## Moderation Enforcement Standards
- **Malicious Content**: Immediate emergency suspension; immutable audit entry created.
- **Undeclared Permissions**: Rejected until manifest accurately reflects all runtime behavior.
- **Review Manipulation**: Fraudulent or self-reviews removed with audit logging.
- **Immutability Principle**: Published package binaries cannot be altered in-place. Updates require a new SemVer release.
