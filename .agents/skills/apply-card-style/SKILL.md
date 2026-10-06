---
name: apply-card-style
description: Restyle supplied card artwork as whimsical ink-and-watercolor illustrations while retaining the original subject, card numeral, suit symbol, and aspect ratio. Use when applying this visual style to Scoundrel cards.
---

# Apply Card Style

## Agent compatibility

These instructions work with Codex, OpenCode, and other agents that can read Markdown skills. Keep this file at `.agents/skills/apply-card-style/SKILL.md` as the repository's shared source.

- **OpenCode:** discovers this project location directly; load `apply-card-style` with its skill tool. See [OpenCode skill discovery](https://opencode.ai/docs/skills/).
- **Other agents:** read this file directly when asked to apply the card style.

Skill loading and image-editing capability are separate. Use the host agent's available tools; do not assume Codex-specific tool names, plugins, or another installed skill exist.

## Workflow

Inspect the supplied card image using an available image viewer or vision tool to identify its subject, defining accessories, numeral, card symbol, and original colors. Measure the source width and height using image metadata. Resolve repository-relative image and output paths from the repository root, not the skill directory. Use the image as the reference for image generation, adapting the reusable prompt below to the observed subject without hardcoding a rank or suit. Include the measured dimensions and ratio in the request.

Use an available image-editing tool that accepts reference images: a native tool, configured MCP service, or configured CLI/API. In Codex, prefer its native image-generation tool when exposed. In OpenCode, use the equivalent configured capability and its documented input format. Pass the actual source image as a reference; a text-only generation request is insufficient to preserve the artwork. Preserve existing transparency unless the user asks to change it.

If no reference-image editing capability is available, save the adapted prompt, source image path, source dimensions, and intended output path in `output/imagegen/<source-stem>-prompt.md` (or the user's chosen destination). Explain that image generation remains pending and identify the missing capability. If image inspection is also unavailable, mark subject/index details as unverified and request those details or a vision-capable tool. Do not claim to have generated or visually verified an image. Do not install a provider or require Codex solely to use this skill.

Keep the numeral and card symbol even when requesting no additional text. Use the source's measured aspect ratio, rather than assuming a fixed size. After generation, inspect the subject and corner index and verify that the output dimensions retain that ratio (`outputWidth × sourceHeight = outputHeight × sourceWidth`). If the backend cannot produce that ratio, report the mismatch before treating the result as complete; do not stretch or crop away the subject or corner index. Save a new version under `output/imagegen/` unless the user specifies another destination; replace original artwork only when requested. Return the saved image path and report any checks that could not be performed.

## Reusable image-generation prompt

Transform the attached card artwork into a whimsical hand-drawn illustration of its original subject. Preserve the subject's recognizable features while simplifying it into plump rounded shapes, short limbs where appropriate, wide circular eyes, and a gently curious expression.

Use loose black ink contours with slight wobble, varied line thickness, occasional broken strokes, and sparse details. Apply muted moss-green watercolor washes with pale powder-blue accents, translucent uneven pigment, and soft watercolor blooms. Leave generous areas of untouched white paper. Use a front-facing composition with ample white space, minimal shading, and a charming casual sketchbook feel.

**Retain the original card's numeral and card symbol in the upper-left corner, with the symbol directly beneath the numeral.** Preserve their original colors, shapes, typography, relative size, spacing, and margins. Keep both clearly readable and unobstructed. Include no additional text.

**Match the attached source image's exact height-to-width ratio.** Keep the complete subject and its defining accessories within the frame.

Avoid scenery, polished vector lines, glossy rendering, dramatic lighting, dense textures, and detailed realism.
