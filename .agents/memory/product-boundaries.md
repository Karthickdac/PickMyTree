---
name: Product boundaries
description: Pick My Tree branding, scope, sample inventory and sign-in requirements.
---

Build everything in the supplied PICK A TREE specification, not only the MVP. Unavailable providers and business approvals must remain explicit blockers, never silently omitted.

**Why:** The user asked for every feature without anything missed.

**How to apply:** Track the full coverage plan and report partial delivery honestly.

The brand is **Pick My Tree**, renamed from PICK A TREE.

**Why:** The user explicitly renamed the brand.

**How to apply:** Use Pick My Tree for visible branding and copy; retain the original specification's requirements.

The user said: "no more prelaunch. it should be ready to add the farms. add one farm with test data and trees,images that we can edit and upload".

**Why:** The user wants usable farm administration, not an informational waiting page.

**How to apply:** Provide real editing and persistent uploads. Clearly distinguish the explicitly requested sample inventory from real operating farms without global prelaunch banners.

The login page must not have lengthy content.

**Why:** The user explicitly asked for a short login page.

**How to apply:** Keep the login surface focused on mobile-number/OTP access rather than explanatory steps and cards.

Sign-in should be very simple: mobile number and OTP.

**Why:** The user explicitly requested this instead of the initially provisioned email-based sign-in.

**How to apply:** Use a managed identity provider that actually supports phone OTP and real SMS delivery; do not substitute email/password or a demo OTP. Replit-managed Clerk does not support SMS sign-in, as confirmed in official documentation during setup.

Use Twilio as the SMS delivery provider behind Auth0.

**Why:** The user selected “Set up Twilio (recommended)” when choosing how to enable mobile OTP delivery.

**How to apply:** Prefer Auth0's native Twilio phone-provider configuration while keeping the existing mobile-OTP identity flow. A provider selection is not proof that an account, sender or working delivery has been configured.

The Auth0 connection form observed here accepts only an unqualified, hyphenated tenant name. A regional `.us.auth0.com` tenant resolved successfully through its discovery endpoint, but adding `.us` to the form's subdomain field failed validation; omitting it reached an unrecognized tenant.

**Why:** Repeated connection attempts cannot fix a regional-domain mismatch in the form.

**How to apply:** Do not ask the user to repeat those two failed inputs. Use direct Auth0 application configuration with the verified issuer, or a connector only after regional support is established.
