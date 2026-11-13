// Android TV / Google TV: show the app on the TV home screen (Leanback launcher), do not require
// a touchscreen, and give it the 320x180 banner the TV launcher uses.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

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

module.exports = (config) => withTvBanner(withTvManifest(config));
