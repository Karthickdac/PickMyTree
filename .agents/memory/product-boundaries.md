---
name: Product boundaries
description: Pick My Tree branding, scope, sample inventory and sign-in requirements.
---

Build everything in the supplied PICK A TREE specification, not only the MVP. Unavailable providers and business approvals must remain explicit blockers, never silently omitted.

**Why:** The user asked for every feature without anything missed.

**How to apply:** Track the full coverage plan and report partial delivery honestly.

The platform also has investment plans whose return on investment is based on yield. The owner will configure them manually as normal schemes, with capital repayment defined separately for each plan. Checkout must collect payments for investment plans as well as adoption purchases.

**Why:** The user clarified that investment plans are included, then said: "The investment plans can be configured as a normal scheme plan. I'll configure that manually. I just want you to remove the (no investment) related content". They also confirmed checkout should collect investment-plan payments. This overrides the original specification's adoption-only restriction.

**How to apply:** Remove blanket "not an investment" and "no returns" statements from public copy. Use the normal scheme configuration rather than inventing a separate investment-plan type or ROI calculator. Do not require the owner to define an automated payout formula for this copy change. Keep plan-specific risks and legal-review notices; do not infer fixed or guaranteed returns. Confirm payment-provider eligibility for investment collections before enabling live charges.

Checkout should be very smooth and easy to pay.

**Why:** The user asked: "Check-out purchase should be very smooth and easy to pay. It should drive the user to pay without any second thoughts".

**How to apply:** Minimize required fields and repeated sign-in, show the scheme and full payable amount before payment, support the connected provider's available payment methods, and preserve progress on failed payments. Confirm purchases only after server-side payment verification; keep scheme terms and risks visible.

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
