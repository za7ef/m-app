// Android TV / Google TV: show the app on the TV home screen (Leanback launcher), do not require
// a touchscreen, and give it the 320x180 banner the TV launcher uses.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withAppBuildGradle } = require('expo/config-plugins');

const BANNER = 'assets/tv-banner.png';

function withTvManifest(config) {
  return withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m['uses-feature'] = (m['uses-feature'] || []).filter((f) => !['android.hardware.touchscreen', 'android.software.leanback'].includes(f.$['android:name']));
    m['uses-feature'].push({ $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'false' } });
    m['uses-feature'].push({ $: { 'android:name': 'android.software.leanback', 'android:required': 'false' } });
    const app = m.application?.[0];
    if (app) {
      app.$['android:banner'] = '@drawable/tv_banner';
      const main = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
      if (main) {
        // TV is always landscape; let the activity follow the screen.
        main.$['android:screenOrientation'] = 'landscape';
        const filters = main['intent-filter'] || [];
        const launcher = filters.find((f) => (f.action || []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN'));
        if (launcher) {
          launcher.category = launcher.category || [];
          if (!launcher.category.some((x) => x.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
            launcher.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
          }
        }
      }
    }
    return c;
  });
}

function withTvBanner(config) {
  return withDangerousMod(config, ['android', (c) => {
    const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/drawable-xhdpi');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(c.modRequest.projectRoot, BANNER), path.join(dir, 'tv_banner.png'));
    return c;
  }]);
}

// Per-ABI APKs: app-arm64-v8a-release.apk and app-armeabi-v7a-release.apk, each with only its own native
// libraries (about half the size). A universal APK is still produced and keeps the name app-release.apk
// so the existing CI step that copies app-release.apk keeps working.
function withAbiSplits(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes('// M-TV-ABI-SPLITS')) return c;
    g = g.replace(/android\s*\{/, `android {
    // M-TV-ABI-SPLITS
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a"
            universalApk true
        }
    }`);
    g += `
// M-TV-ABI-SPLITS: distinct versionCode per ABI (armv7 < arm64 < universal) and keep the universal name.
android.applicationVariants.all { variant ->
    variant.outputs.each { output ->
        def abi = output.getFilter(com.android.build.OutputFile.ABI)
        def codes = ["armeabi-v7a": 1, "arm64-v8a": 2]
        output.versionCodeOverride = variant.versionCode * 10 + (abi ? codes.get(abi, 0) : 9)
        if (abi == null) output.outputFileName = "app-\${variant.buildType.name}.apk"
    }
}
`;
    c.modResults.contents = g;
    return c;
  });
}

module.exports = (config) => withAbiSplits(withTvBanner(withTvManifest(config)));
