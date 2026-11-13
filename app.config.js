// Same config as app.json, plus the Android TV / Google TV build: landscape, Leanback launcher,
// banner, and no touchscreen requirement. On the "tv" branch the TV build is the default (TV_BRANCH);
// elsewhere it is enabled with EXPO_PUBLIC_TV=1. Phone builds from main are unchanged.
const TV_BRANCH = true;
module.exports = ({ config }) => {
  const tv = TV_BRANCH || process.env.EXPO_PUBLIC_TV === '1';
  if (!tv) return config;
  return {
    ...config,
    name: 'M TV',
    orientation: 'landscape',
    extra: { ...(config.extra || {}), tv: true },
    plugins: [...(config.plugins || []), './plugins/withAndroidTV'],
  };
};
