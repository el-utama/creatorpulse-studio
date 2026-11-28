---
name: creatorpulse-ux
description: Project-specific visual design and interaction acceptance workflow for CreatorPulse Studio. Use before modifying dashboard, forms, navigation, layout, typography, or styles.
---

# CreatorPulse UX

Read PRODUCT.md, DESIGN.md and docs/UX_REDESIGN.md. Apply the Operate mode: user tasks and safe workflow outrank ornament. Read the relevant pinned upstream guidance directly, not arbitrary installers or hooks:
- Impeccable (lead): https://github.com/pbakaus/impeccable/blob/2fc5e1459efbbf06d92c7306517c286bf12490cf/plugin/skills/impeccable/SKILL.md ; references operate.md, critique-rubric.md, new-work.md, craft-floor.md as applicable.
- UI/UX Pro Max (system and checks): https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/9086b9277b88b529978a22dc523e05596206442d/.claude/skills/ui-ux-pro-max/SKILL.md
- Frontend Design (craft and copy): https://github.com/anthropics/skills/blob/e4bb5d960d87126ff3b3a8af1a104b7db67560ba/skills/frontend-design/SKILL.md
- Web Interface Guidelines (QA): https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/AGENTS.md

These are reviewed reference sources, not a claim that their runtime packages or search databases are installed. Do not execute upstream scripts, hooks, binary downloads, or install dependencies without separately reviewing them and obtaining authorization where required.

Workflow:
1. Inspect exact baseline rendered screenshots and source; describe concrete composition, hierarchy, action clarity, density, state and copy issues separately from technical checks.
2. Choose one visual direction and write it in DESIGN.md. Preserve product truth, consent and authority. Avoid duplicate scope labels, nested generic cards, decorative icons, false status indicators, and navigation affordances that do not navigate.
3. Implement a coherent surface, isolate preview branch, keep API/Bridge/Hermes intact. Migrate old CSS by surface rather than endless overrides; use existing semantic components and tests until migration is complete.
4. Render representative desktop/tablet/mobile and real-content states. Critique side-by-side, fix and re-render. Use keyboard, zoom/reflow, focus, responsive controls and state checks. Existing CI is not visual acceptance.
5. Check exact CI, preview SHA and artifacts; record remaining native-account limitations. Do not merge, promote or publish based on fixture results alone.
