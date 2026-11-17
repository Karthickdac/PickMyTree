---
name: Product boundaries
description: Pick My Tree branding, scope, sample inventory and sign-in requirements.
---

Build everything in the supplied PICK A TREE specification, not only the MVP. Unavailable providers and business approvals must remain explicit blockers, never silently omitted.

**Why:** The user asked for every feature without anything missed.

**How to apply:** Track the full coverage plan and report partial delivery honestly.

The commercial model is tree adoption with harvest entitlements, not direct investment. One scheme gives a fixed quantity of yield; another gives the tree's full yield. The full yield can be delivered or sold, with the sale money sent to the customer. The owner will configure these as normal schemes, and checkout must support both.

**Why:** The user initially used investment/ROI terminology, then clarified: "This is not direct investment, this part of tree adoption, one scheme will give fixed size of yield and another one give full yield of that tree, either deliver the full yield or will sell the yield and send that money to customer". They also said they will configure the schemes manually and asked to remove the blanket "no investment" content. The harvest-entitlement clarification supersedes the earlier standalone-investment interpretation.

**How to apply:** Use normal scheme configuration for fixed-quantity and full-harvest entitlements, with delivery or sale-proceeds settlement as applicable. Do not invent a separate investment-plan type or ROI calculator, and do not restore blanket "not an investment"/"no returns" copy. Distinguish the initial purchase payment from later payments of harvest-sale proceeds. Keep scheme-specific terms, deductions, risks and legal-review notices. Describe the actual model, including the cash-settlement option, when confirming payment-provider eligibility; do not infer its legal classification from the label.

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
