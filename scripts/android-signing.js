// Adds a release signing config to the prebuilt Android project (run after `expo prebuild`).
// Reads the keystore from env: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS.
const fs = require('fs');
const f = 'android/app/build.gradle';
let g = fs.readFileSync(f, 'utf8');
if (!process.env.ANDROID_KEYSTORE_PATH) { console.log('No keystore env: release uses the debug key.'); process.exit(0); }
g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            storeType "pkcs12"
        }`);
g = g.replace(/(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/s, '$1signingConfig signingConfigs.release');
if (!/signingConfig signingConfigs\.release/.test(g)) throw new Error('could not set release signing');
fs.writeFileSync(f, g);
console.log('Release signing configured.');
