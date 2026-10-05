#!/bin/bash
# build-stripped-template.sh — Phase 1 spike: custom Godot 4.7.2 web template
# stripped of 3D + everything the Scoundrel board frame cannot use
# (docs/plans/godot-plan.md "Asset pipeline": "the known remedy is a stripped
# custom export template (disable 3D and unneeded modules)").
#
# Kept:   gdscript (the frame's language), regex (WebBridge envelope checks),
#         webp (lossy .ctex decoding), text_server_fb (light text server —
#         the frame renders no text, but keeps boot safety).
# Stripped: 3D engine-wide + physics, Vulkan, and every module the frame
#         never touches: media formats (jpg/ogg/vorbis/mp3/theora/tga/dds/hdr/
#         ktx/tinyexr/bmp), VRAM texture codecs (astcenc/basis_universal/bcdec/
#         betsy/cvtt/etcpak), fonts (freetype/msdfgen), networking/TLS
#         (enet/mbedtls/websocket/webrtc/upnp/multiplayer), 3D authoring
#         (csg/gltf/fbx/gridmap/xatlas_unwrap/vhacd/lightmapper_rd/meshoptimizer/
#         mobile_vr/openxr/webxr/glslang/visual_shader), navigation, noise,
#         physics modules, jsonrpc, interactive_music, raycast, zip.
# Output: godot-src/bin/web_nothreads_release.zip (overwrites the stock
#         template in the self-contained toolchain after measurement).
set -e
# Windows: the per-user Python (winget) is not on PATH; CI Linux has python3.
if [ -n "$LOCALAPPDATA" ] && [ -d "$LOCALAPPDATA/Programs/Python/Python312" ]; then
  export PATH="$LOCALAPPDATA/Programs/Python/Python312:$LOCALAPPDATA/Programs/Python/Python312/Scripts:$PATH"
fi
export PATH="$HOME/emsdk/upstream/emscripten:$HOME/emsdk/upstream/bin:$PATH"
export EMSDK="$HOME/emsdk"
# The OFFICIAL 4.7.2 web toolchain pin (godotengine/build-containers
# Dockerfile.web: EMSCRIPTEN_VERSION=6.0.1). Refuse a different emcc so the
# produced template stays reproducible against the official pin.
WANT=6.0.1
if [ -f "$HOME/emsdk/emsdk.bat" ]; then
  "$HOME/emsdk/emsdk.bat" activate "$WANT" >/dev/null 2>&1
else
  "$HOME/emsdk/emsdk" activate "$WANT" >/dev/null 2>&1
fi
GOT=$(emcc --version 2>/dev/null | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)
if [ "$GOT" != "$WANT" ]; then
  echo "emsdk $WANT is required (official 4.7.2 pin); install it first: emsdk install $WANT" >&2
  exit 2
fi
# Python: resolve a REAL interpreter. The Windows Store python3/python stubs
# resolve via command -v but exit 9009 when run — probe each candidate first.
resolve_py() {
  for cand in python3 python "$LOCALAPPDATA/Programs/Python/Python312/python.exe"; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'pass' >/dev/null 2>&1; then
      command -v "$cand"
      return 0
    fi
  done
  echo "no usable python interpreter found (needed for SCons + the toolchain.json pin)" >&2
  return 1
}
PY=$(resolve_py) || exit 2

# Godot source: provision + verify against the exact-commit pin in
# toolchain.json ("source"). Nothing else in the pipeline clones it, so a
# cache-only tree would deadlock CI and a stale cache would silently build
# different engine code — both are loud failures here instead.
SRC_JSON="$(dirname "$0")/../godot/toolchain.json"
SRC_DIR="$(dirname "$0")/../.toolchain/godot-src"
PIN_PY=$PY
read -r SRC_URL SRC_TAG SRC_COMMIT <<< "$("$PIN_PY" -c 'import json,sys;j=json.load(open(sys.argv[1]))["source"];print(j["repository"],j["tag"],j["commit"])' "$SRC_JSON")"
verify_src() {
  ACTUAL=$(git -C "$SRC_DIR" rev-parse HEAD 2>/dev/null || echo missing)
  if [ "$ACTUAL" != "$SRC_COMMIT" ]; then
    echo "godot-src at '$ACTUAL', expected $SRC_COMMIT ($SRC_TAG) — re-cloning" >&2
    rm -rf "$SRC_DIR"
    git clone --depth 1 --branch "$SRC_TAG" "$SRC_URL" "$SRC_DIR"
    ACTUAL=$(git -C "$SRC_DIR" rev-parse HEAD)
  fi
  if [ "$ACTUAL" != "$SRC_COMMIT" ]; then
    echo "FATAL: tag $SRC_TAG no longer points at the pinned commit $SRC_COMMIT; re-pin godot/toolchain.json" >&2
    exit 3
  fi
}
verify_src
cd "$SRC_DIR"

# -j: 16 locally, cores available on CI (cap 8 to bound memory).
JOBS=$(nproc 2>/dev/null || echo 8)
JOBS=$((JOBS > 8 ? 8 : JOBS))

$PY -m SCons -j"$JOBS" platform=web target=template_release arch=wasm32 \
  production=yes debug_symbols=no threads=no \
  disable_3d=yes disable_physics_2d=yes vulkan=no \
  module_astcenc_enabled=no module_basis_universal_enabled=no module_bcdec_enabled=no \
  module_betsy_enabled=no module_bmp_enabled=no module_camera_enabled=no \
  module_csg_enabled=no module_cvtt_enabled=no module_dds_enabled=no \
  module_enet_enabled=no module_etcpak_enabled=no module_fbx_enabled=no \
  module_freetype_enabled=no module_glslang_enabled=no module_gltf_enabled=no \
  module_godot_physics_2d_enabled=no module_godot_physics_3d_enabled=no \
  module_gridmap_enabled=no module_hdr_enabled=no module_interactive_music_enabled=no \
  module_jolt_physics_enabled=no module_jpg_enabled=no module_jsonrpc_enabled=no \
  module_ktx_enabled=no module_lightmapper_rd_enabled=no module_mbedtls_enabled=no \
  module_meshoptimizer_enabled=no module_mobile_vr_enabled=no module_mp3_enabled=no \
  module_msdfgen_enabled=no module_multiplayer_enabled=no module_navigation_2d_enabled=no \
  module_navigation_3d_enabled=no module_noise_enabled=no module_ogg_enabled=no \
  module_openxr_enabled=no module_raycast_enabled=no module_svg_enabled=no \
  module_text_server_adv_enabled=no module_theora_enabled=no module_tga_enabled=no \
  module_tinyexr_enabled=no module_upnp_enabled=no module_vhacd_enabled=no \
  module_visual_shader_enabled=no module_vorbis_enabled=no module_webrtc_enabled=no \
  module_websocket_enabled=no module_webxr_enabled=no module_xatlas_unwrap_enabled=no \
  module_zip_enabled=no \
  "$@"
