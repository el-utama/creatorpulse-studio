# Agent entry point — CreatorPulse Studio

If asked to install, resume, recover or validate CreatorPulse Sandbox, **execute the repository runbook**, not just summarize it: [integrations/hermes/SANDBOX_RUNBOOK.md](integrations/hermes/SANDBOX_RUNBOOK.md).

- Start with a clean dedicated checkout of branch sandbox, or update the existing clean checkout fast-forward only. Record the commit. Never reset a dirty worktree.
- Inspect current host state before changing anything. Continue from the first unfinished gate. Do all non-privileged work locally, including diagnostics, preparation, retries of safe read-only checks and MCP tests. Do not send the owner individual terminal commands.
- Do not access bridge, vault, operator, TikTok or Vercel owner credentials. Never read private service files, dump environment variables, logs containing secrets, or use existing owner login sessions. Only the owner may run privileged setup or provision the agent-only credentials. Prepare one reviewed owner action when required.
- Never elevate the agent, change the default Hermes profile, modify existing model/messaging gateways, change Tailscale routes or Vercel protection, or publish content. No production changes from sandbox.
- Report actual evidence and remaining blockers in a single concise report. A configured gateway, local discovery or successful fixture tests alone do not establish live account connectivity.
- For code changes follow README and relevant tests. Production release and posting require separate explicit owner approval.
