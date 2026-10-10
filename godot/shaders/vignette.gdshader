shader_type canvas_item;
// Radial damage/celebration vignette (plan: vignette via screen-covering
// shaders is supported on the Compatibility renderer). The fx-director
// animates `strength` (0 = invisible).

uniform vec4 tint : source_color = vec4(0.878431, 0.337255, 0.309804, 1.0);
uniform float strength : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec2 centered = UV - vec2(0.5);
	float dist = length(centered) * 2.0; // 0 center → 1 edge (corners ~1.41)
	// Soft interior falloff, strong at the edges.
	float mask = smoothstep(0.35, 1.15, dist);
	COLOR = vec4(tint.rgb, tint.a * mask * strength);
}
