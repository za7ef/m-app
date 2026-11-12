// R8 stripped the no-arg constructor of WorkManager's generated Room database (WorkDatabase_Impl), so the app
// crashed at launch (androidx.startup -> WorkManagerInitializer) once expo-background-task pulled WorkManager in.
// Keep Room/WorkManager classes in the release build.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# --- M: keep WorkManager / Room (expo-background-task) ---
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.** { *; }
-keep class androidx.room.** { *; }
-keep class androidx.startup.** { *; }
`;

module.exports = (config) => withDangerousMod(config, ['android', (cfg) => {
  const f = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (!cur.includes('M: keep WorkManager')) fs.writeFileSync(f, cur + RULES);
  return cfg;
}]);
