// Embeds MobileVLCKit.framework (arm64) into the iOS app WITHOUT linking it.
// The VLC module opens it with dlopen() only when a VLC source is played, so a
// problem with the framework can never crash the app at launch.
const { withXcodeProject } = require('expo/config-plugins');

const VLC_URL = 'https://download.videolan.org/pub/cocoapods/prod/MobileVLCKit-3.6.0-c73b779f-dd8bfdba.tar.xz';
const VLC_SHA = '1a5077beeb7bf943a3fbbb91523752e50a10d490a3046cb9808d906784ddbc36';

const script = `set -e
if [ "$PLATFORM_NAME" != "iphoneos" ]; then exit 0; fi
CACHE="$PROJECT_DIR/../.vlc-cache"
mkdir -p "$CACHE"
if [ ! -d "$CACHE/MobileVLCKit-binary" ]; then
  curl -sSL "${VLC_URL}" -o "$CACHE/vlc.tar.xz"
  echo "${VLC_SHA}  $CACHE/vlc.tar.xz" | shasum -a 256 -c -
  tar -xJf "$CACHE/vlc.tar.xz" -C "$CACHE"
  rm -f "$CACHE/vlc.tar.xz"
fi
SRC=$(ls -d "$CACHE"/MobileVLCKit-binary/MobileVLCKit.xcframework/ios-arm64*/MobileVLCKit.framework | grep -v simulator | head -1)
DST="$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH/MobileVLCKit.framework"
rm -rf "$DST"; mkdir -p "$DST"
cp "$SRC/Info.plist" "$DST/"
lipo "$SRC/MobileVLCKit" -thin arm64 -output "$DST/MobileVLCKit" 2>/dev/null || cp "$SRC/MobileVLCKit" "$DST/MobileVLCKit"
# Modern iOS rejects embedded frameworks declaring very old minimum OS versions.
/usr/libexec/PlistBuddy -c "Set :MinimumOSVersion 15.1" "$DST/Info.plist" || true
if [ -n "$EXPANDED_CODE_SIGN_IDENTITY" ] && [ "$CODE_SIGNING_ALLOWED" != "NO" ]; then
  codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" --preserve-metadata=identifier,entitlements "$DST"
fi
echo "Embedded MobileVLCKit (not linked) -> $DST"
`;

module.exports = function withVlcEmbed(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const target = project.getFirstTarget().uuid;
    const name = '[M] Embed MobileVLCKit (dlopen)';
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    if (!Object.values(phases).some((p) => p && p.name && p.name.includes('Embed MobileVLCKit'))) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', name, target, { shellPath: '/bin/sh', shellScript: script.replace(/\n/g, '\\n') });
    }
    // The script writes into the app bundle; allow it.
    const configs = project.pbxXCBuildConfigurationSection();
    for (const k in configs) {
      const bs = configs[k] && configs[k].buildSettings;
      if (bs && bs.PRODUCT_NAME) bs.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }
    return cfg;
  });
};
