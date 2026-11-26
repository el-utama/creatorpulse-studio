# CreatorPulse Sandbox — executable entry point

For existing PC09 Sandbox recovery, first fetch and fast-forward the clean sandbox checkout. Never reset dirty files. Then run **python integrations/hermes/windows_resume.py** using the existing Hermes Python (with PyYAML). Do not interpret old reports or choose recovery steps yourself. The program emits one JSON state; use only its reported next action. Do not print secrets or raw subprocess data.

- OWNER_PROVISION: open the exact reported owner script location for independent owner review/staging; do not execute it elevated yourself. The owner checks Windows CI for this commit first. The script inventories and protects known retired copies only with explicit owner approval, then provisions credentials. Do not tell the owner to type ISOLATED before their actual review. No separate agent credential audit is needed.
- OWNER_HISTORY_UPGRADE: open the exact reported helper for the owner; only after exact revision Verify and Windows CI pass, owner independently stages it under administrator control and runs elevated, approves UPGRADE. Do not elevate Hermes, overwrite the live database, or run the old installer. Then resume controller.
- OWNER_ENROLL: open the reported dashboard for the owner. No OAuth or Operator Key handling by the agent.
- READONLY_VALIDATED: report the actual returned evidence and caveat, not a claim of production or full isolation.
- Any other state: report the JSON blocker unchanged. Do not improvise, reset, reinstall, elevate, edit permissions, generate keys, change protection, or publish.

After owner action, run the same controller again. No placeholders, manual credential file creation, or path requests. Never access owner secrets or sessions. Preserve default Hermes, messaging, Tailscale, existing DB, and Production. The [runbook](integrations/hermes/SANDBOX_RUNBOOK.md) documents owner boundaries and other installations; the controller is authoritative for existing PC09. Do not claim that a hidden file is absent. Only the owner may approve privileged actions and project-wide bypass.
