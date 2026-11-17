---
name: Approval chronology
description: Why authoritative approval decisions need a monotonic append sequence rather than transaction timestamps.
---

Order approval and revocation decisions by their monotonic append sequence, not by transaction start timestamps.

**Why:** PostgreSQL's `now()` is the transaction start time. A transaction can start earlier, wait for the review lock, then append after a transaction whose timestamp is later. Sorting by timestamp can consequently restore an approval that was actually revoked afterward.

**How to apply:** Preserve the review serialization and sequence-based head selection when changing approval, revocation or reapproval behavior. A current decision must also match the exact reviewed content version and have an unexpired validity period.
