---
name: App Storage SDK compatibility
description: Why storage dependency upgrades need a real sidecar-backed upload check.
---

Keep the Google Storage and Google Auth SDKs compatible with Replit's provided sidecar credential template. A successfully provisioned bucket and a passing typecheck do not prove uploads work.

**Why:** Newer SDK behavior attempted Google project discovery despite valid Replit sidecar credentials, breaking actual object writes. The compatible SDK pair restored writes without changing the template's credential configuration.

**How to apply:** Before upgrading these dependencies, exercise signed PUT, authenticated object access, metadata validation and public image serving with the real sidecar. Investigate dependency compatibility before replacing credentials or editing the supplied GCS client authentication setup.
