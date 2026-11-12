// Local notifications only: make sure no push (aps-environment) entitlement ends up in the app,
// since SideStore / free Apple IDs can't sign it.
const { withEntitlementsPlist } = require('expo/config-plugins');
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => { delete c.modResults['aps-environment']; return c; });
};
