---
name: Auth0 authorization verification
description: Avoid false session failures when diagnosing provider setup through HTTP requests.
---

Diagnose Auth0 authorization with a cookie-aware redirect chain or a real browser. Plain Node fetch with automatic redirects does not retain cookies across responses.

**Why:** A cookie-free check produced an artificial provider “session not found” error after a callback setting was fixed. Preserving cookies exposed the actual provider configuration error on the callback. The app intentionally replaces provider errors with a safe generic sign-in message.

**How to apply:** Track trusted-origin redirects and inspect only sanitized error codes/descriptions before the callback hides them. Never print or persist session cookies, authorization codes, state, tokens or client credentials. Reaching the phone form is not proof of SMS delivery or a completed login.

Auth0 Universal Login Passwordless SMS requires an Authentication Profile of **Identifier First** or **Identifier First + Biometrics**, in addition to the enabled SMS connection and the application's `connection=sms` parameter.

**Why:** Auth0's Passwordless with Universal Login documentation requires this profile. After the SMS connection was enabled, the standard profile still rendered email/password instead of the requested phone-number flow.

**How to apply:** Check the Authentication Profile when an enabled SMS connection still presents email/password. Warn the user that changing this profile is tenant-wide and can affect other apps sharing the tenant.
