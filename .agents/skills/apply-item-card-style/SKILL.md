---
name: apply-item-card-style
description: Restyle supplied item card artwork as whimsical ink-and-watercolor illustrations while retaining the original item, card numeral, suit symbol, and aspect ratio. Use when applying this visual style to Scoundrel item cards, such as potions and weapons.
---

# Apply Item Card Style

## Agent compatibility

These instructions work with Codex, OpenCode, and other agents that can read Markdown skills. Keep this file at `.agents/skills/apply-item-card-style/SKILL.md` as the repository's shared source.

- **OpenCode:** discovers this project location directly; load `apply-item-card-style` with its skill tool. See [OpenCode skill discovery](https://opencode.ai/docs/skills/).
- **Other agents:** read this file directly when asked to apply the item card style.

Skill loading and image-editing capability are separate. Use the host agent's available tools; do not assume Codex-specific tool names, plugins, or another installed skill exist.

## Workflow

Inspect the supplied card image using an available image viewer or vision tool to identify its item, defining features, numeral, card symbol, and original colors — the source of the illustration's palette. Measure the source width and height using image metadata. Resolve repository-relative image and output paths from the repository root, not the skill directory. Use the image as the reference for image generation, adapting the reusable prompt below to the observed item without hardcoding a rank or suit. Include the measured dimensions and ratio in the request.

Use an available image-editing tool that accepts reference images: a native tool, configured MCP service, or configured CLI/API. In Codex, prefer its native image-generation tool when exposed. In OpenCode, use the equivalent configured capability and its documented input format. Pass the actual source image as a reference; a text-only generation request is insufficient to preserve the artwork. Preserve existing transparency unless the user asks to change it.

If no reference-image editing capability is available, save the adapted prompt, source image path, source dimensions, and intended output path in `output/imagegen/<source-stem>-prompt.md` (or the user's chosen destination). Explain that image generation remains pending and identify the missing capability. If image inspection is also unavailable, mark item/index details as unverified and request those details or a vision-capable tool. Do not claim to have generated or visually verified an image. Do not install a provider or require Codex solely to use this skill.

Keep the numeral and card symbol even when requesting no additional text. Use the source's measured aspect ratio, rather than assuming a fixed size. After generation, inspect the item and corner index and verify that the output dimensions retain that ratio (`outputWidth × sourceHeight = outputHeight × sourceWidth`). If the backend cannot produce that ratio, report the mismatch before treating the result as complete; do not stretch or crop away the item or corner index. Save a new version under `output/imagegen/` unless the user specifies another destination; replace original artwork only when requested. Return the saved image path and report any checks that could not be performed.

## Reusable image-generation prompt

Transform the attached card artwork into a whimsical hand-drawn illustration of its original item. Preserve the item's recognizable silhouette and features while simplifying it into plump rounded shapes, gently exaggerated proportions, and a playful hand-drawn charm. Keep the subject an object: add no eyes, faces, limbs, or expressions unless the original artwork already shows them.

Use loose black ink contours with slight wobble, varied line thickness, occasional broken strokes, and sparse details. Base the palette on the item itself: draw the watercolor washes from the original artwork's dominant hues and the pale accents from its secondary colors, keeping the pigment muted and translucent with soft watercolor blooms. Leave generous areas of untouched white paper. Use a front-facing composition with ample white space, minimal shading, and a charming casual sketchbook feel.

**Retain the original card's numeral and card symbol in the upper-left corner, with the symbol directly beneath the numeral.** Preserve their original colors, shapes, typography, relative size, spacing, and margins. Keep both clearly readable and unobstructed. Include no additional text.

**Match the attached source image's exact height-to-width ratio.** Keep the complete item and its defining features within the frame.

Avoid scenery, polished vector lines, glossy rendering, dramatic lighting, dense textures, and detailed realism.
