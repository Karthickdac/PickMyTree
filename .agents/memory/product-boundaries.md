---
name: Product boundaries
description: User-mandated scope and sign-in experience for PICK A TREE.
---

Build everything in the supplied PICK A TREE specification, not only the MVP. Unavailable providers and business approvals must remain explicit blockers, never silently omitted.

**Why:** The user asked for every feature without anything missed.

**How to apply:** Track the full coverage plan and report partial delivery honestly.

Sign-in should be very simple: mobile number and OTP.

**Why:** The user explicitly requested this instead of the initially provisioned email-based sign-in.

**How to apply:** Use a managed identity provider that actually supports phone OTP and real SMS delivery; do not substitute email/password or a demo OTP. Replit-managed Clerk does not support SMS sign-in, as confirmed in official documentation during setup.

The Auth0 connection form observed here accepts only an unqualified, hyphenated tenant name. A regional `.us.auth0.com` tenant resolved successfully through its discovery endpoint, but adding `.us` to the form's subdomain field failed validation; omitting it reached an unrecognized tenant.

**Why:** Repeated connection attempts cannot fix a regional-domain mismatch in the form.

**How to apply:** Do not ask the user to repeat those two failed inputs. Use direct Auth0 application configuration with the verified issuer, or a connector only after regional support is established.
