# PICK A TREE implementation status

This is an incremental build, not a complete platform or launch approval.
The accepted full-platform task remains active. No real tree inventory,
commercial approvals, payments, actual field media or fulfilment is invented.

## Current change: mobile number and OTP

The user requires simple mobile-number/SMS-OTP sign-in instead of email/password.
Managed Clerk was initially provisioned but official Replit documentation
confirms that it does not support SMS/phone sign-in. The public sign-in screens
therefore explain setup status without pretending to send a code.
Auth0 is the proposed managed identity replacement, subject to connection;
SMS/passwordless configuration and actual delivery still require verification.
The existing protected API remains fail-closed pending that integration.

## Delivered foundations, not completed milestones

- React public website and public discovery/information routes.
- PostgreSQL users, scoped grants, workflow drafts, audit events and consents.
- OpenAPI contract, typed clients and request/response validation.
- Real enquiry submission, customer profile/preferences, support case and privacy request endpoints.
- Initial scoped operations document editor, field metadata and reasoned optimistic-lock transitions.
- Abuse limits, secure headers, cross-site mutation checks and protected API routes.
- No automatic first-admin grant; trusted-account bootstrap is still required.

## Coverage register

| Coverage | Current state | Remaining acceptance |
|---|---|---|
| C01 Public website | Initial UI and discovery APIs | CMS page/banner workflows, real approved media/inventory, SEO/accessibility verification |
| C02 Customer accounts/portal | Portal UI and profile/case endpoints | Real phone OTP/session integration, onboarding, complete commercial records |
| C03 Farm/tree inventory | Scoped draft registration | Dedicated normalized inventory tables, uploaded evidence, inspections, identity audits/reassignment |
| C04 Schemes | Commercial draft editor | Approved immutable versions, eligibility and legally approved formulas |
| C05 Commerce | Explicitly unavailable | Reservation/payment/refund/contract/invoice ledgers and provider verification |
| C06 Passport/media | Public explainer | Private owned Passport, upload provenance, moderation and true history |
| C07 Field operations | Initial task drafts/states | Assignment validation, QR camera, offline drafts/sync, evidence and independent completion |
| C08 Agronomy | Assessment/recommendation drafts | Qualified approval workflow, follow-up and immutable expert history |
| C09 Nourish | Public explainer; charging unavailable | Customer approval/payment/work order/application/verification journey |
| C10 Product inventory | Draft product/batch records | Stock movement ledger, safety evidence and application restrictions |
| C11 Harvest capture | Draft observations | Dedicated measurement ledger, verification and corrections |
| C12 Harvest fulfilment | Unavailable | Entitlement engine, reconciliation, dispatch, remedies, settlement |
| C13 Gifting | Real enquiry capture | Quotes/proofs/orders/personalization/redemption/fulfilment |
| C14 Experiences | Enquiry capability only | Offer configuration, capacity, safe bookings/cancellation and policy approval |
| C15 Notifications/Tamil | Preference data and UI foundation | Outbox, templates/translations, in-app events and connected delivery providers |
| C16 Support/privacy | Own-case and request records | Threads, attachments, owners, SLA/escalation/remedies/retention fulfillment |
| C17 Administration | Scoped draft-workspace foundation | User/role management UI, immutable DB enforcement, access review and full CMS |
| C18 Reports | Scoped record counts only | All operational/commercial KPIs, scoped export and metric definitions |
| C19 Security/reliability | Initial access and API controls | Phone-session/MFA validation, upload scanning, security checks, durable jobs, recovery rehearsal |
| C20 Full delivery | Initial static checks and preview | Full workflow tests, devices, field acceptance, operational/portability/runbook evidence |

The workflow document store is not a financial or harvest ledger and must not
be used to enable checkout, approved treatment purchasing or verified allocations.
Dedicated domain schemas and transactional tests are still required by the plan.

## External/business dependencies

Founder/legal: contracting entity, approved terms/remedies, privacy retention,
farm authority, visit policy. Finance: prices, costs, taxes, refund/payout policy.
Operations/agronomist: real farms/trees, productive-stage evidence, qualified
assessments, original media, weighing/delivery procedures.
Providers: managed phone identity/SMS, payments, notifications and logistics.

Production publication and live external side effects require separate approval.
