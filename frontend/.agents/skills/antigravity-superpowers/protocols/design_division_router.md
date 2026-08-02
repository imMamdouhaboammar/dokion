# 🎨 Protocol 12: Design Division Router & Specialization Matrix

## 1. Overview
The global system skills directory (`~/.gemini/config/skills/`) contains 10 specialized Design Division roles (`design-*`). This protocol establishes how Antigravity routes UI/UX design, brand identity, visual storytelling, and image prompt engineering tasks across all projects.

## 2. Specialization Matrix & Role Mapping

### 🎨 UI/UX & Interaction Design
- `design-ui-designer`: Visual design systems, component libraries, typography, responsive grids, pixel-perfect interface creation.
- `design-ux-architect`: Information architecture, interaction flows, user journey mapping, design systems infrastructure.
- `design-ux-researcher`: User behavior research, cognitive walkthroughs, usability evaluation, CRO analysis.
- `design-ui-finish-gate-reviewer`: Grounds UI critique in product evidence; eliminates generic, interchangeable AI boilerplate before shipping.

### 🖼️ Visuals, Branding & Creative Whimsy
- `design-brand-guardian`: Brand strategy, identity consistency, design token alignment, visual positioning.
- `design-image-prompt-engineer`: High-fidelity AI photography and visual asset prompt engineering.
- `design-inclusive-visuals-specialist`: Cultural representation, bias mitigation, inclusive visual storytelling.
- `design-visual-storyteller`: Narrative graphics, infographics, data visualization aesthetics, visual campaigns.
- `design-whimsy-injector`: Delighter moments, playful micro-interactions, unexpected creative polish.
- `design-persona-walkthrough`: Simulates user cognitive walkthroughs from targeted buyer/user personas.

## 3. Design Execution Workflow
1. **Design Scope Assessment**: Identify whether the task requires core layout design, UX architecture, brand alignment, image prompt engineering, or visual finish gate review.
2. **Specialized Designer Dispatch**: Dispatch subagents using `invoke_subagent` with the selected `design-*` role.
3. **Finish Gate Enforcement**: Review UI outputs against design tokens, responsiveness, and anti-slop guidelines before finalizing code.
