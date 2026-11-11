// Android: allow plain http. Needed for the local stream server (http://127.0.0.1) and for
// self-hosted/LAN add-ons and streaming servers (the app shows a notice for http add-ons).
const { withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) => withAndroidManifest(config, (c) => {
  const app = c.modResults.manifest.application?.[0];
  if (app) app.$['android:usesCleartextTraffic'] = 'true';
  return c;
});
