// Android Auto Backup: keep downloaded videos (files/downloads/) out of cloud backup and device transfer.
// Replaces expo-secure-store's backup rule files with ours, which keep its rules (back up shared prefs except
// SecureStore) and add an explicit exclusion for the downloads folder. Whichever plugin runs first, ours wins:
// secure-store only writes its own rules when none are set.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const COMMON = `    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="file" path="downloads/"/>`;
const FULL = `<?xml version="1.0" encoding="utf-8"?>
<!-- Auto Backup, Android 11 and lower -->
<full-backup-content>
${COMMON}
</full-backup-content>
`;
const EXTRACT = `<?xml version="1.0" encoding="utf-8"?>
<!-- Auto Backup, Android 12 and higher -->
<data-extraction-rules>
  <cloud-backup>
${COMMON}
  </cloud-backup>
  <device-transfer>
${COMMON}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = (config) => {
  config = withDangerousMod(config, ['android', (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'm_backup_rules.xml'), FULL);
    fs.writeFileSync(path.join(dir, 'm_data_extraction_rules.xml'), EXTRACT);
    return cfg;
  }]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:fullBackupContent'] = '@xml/m_backup_rules';
      app.$['android:dataExtractionRules'] = '@xml/m_data_extraction_rules';
    }
    return cfg;
  });
};
