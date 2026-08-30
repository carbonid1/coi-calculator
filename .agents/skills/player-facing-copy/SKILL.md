---
name: player-facing-copy
description: Write or edit player-facing Captain of Industry text, including in-game labels, settings, tooltips, mod descriptions, READMEs, and release notes. Use whenever changing words players will read; do not use for logs, code comments, internal engineering docs, or publishing checklists.
---

# Player-Facing Copy

Write like a concise human maintainer. Lead with what the feature shows or does.
Keep in-game copy shortest, give mod descriptions only enough context to decide
whether to install, and keep README mechanics easy to scan. Remove internal terms
such as callbacks, evaluation logic, snapshots, and implementation conventions.

Use exact game terminology and capitalization. Preserve numbers and behavior that
affect player decisions, but do not explain familiar mechanics or repeat safety
assurances. Prefer “Waiting bays,” “Fluid,” and “Universal”; never invent a visible
“None” type. If no real type applies, use an unlabeled generic presentation.

Release notes describe changes only. Use short bullets with one useful idea each.
Do not mention behavior that stayed unchanged merely to reassure the reader.

## Examples

- Bad: “When off, its toolbar button and Train Network evaluation are inactive.”
  Good: “Off stops dashboard updates.”
- Bad: “Kept jam alerts active and unchanged regardless of the dashboard setting.”
  Good: “Dashboard can now be disabled and is off by default.”
- Bad: “Provides human-readable visibility into waypoint utilization and liquid wagons.”
  Good: “See busy Waiting bays and Fluid trains.”
