---
name: Auth0 authorization verification
description: Avoid false session failures when diagnosing provider setup through HTTP requests.
---

Diagnose Auth0 authorization with a cookie-aware redirect chain or a real browser. Plain Node fetch with automatic redirects does not retain cookies across responses.

**Why:** A cookie-free check produced an artificial provider “session not found” error after a callback setting was fixed. Preserving cookies exposed the actual provider configuration error on the callback. The app intentionally replaces provider errors with a safe generic sign-in message.

**How to apply:** Track trusted-origin redirects and inspect only sanitized error codes/descriptions before the callback hides them. Never print or persist session cookies, authorization codes, state, tokens or client credentials. Reaching the phone form is not proof of SMS delivery or a completed login.
