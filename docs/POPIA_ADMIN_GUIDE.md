# Privacy & POPIA — Administrator Guide

What the Privacy & POPIA Management module does, how to use it day-to-day, and what's still manual. Written for whoever ends up handling privacy requests, not for developers — see `server/prisma/schema.prisma` and `server/src/lib/consentService.js` / `dataSubjectService.js` / `retentionService.js` if you need the technical detail.

This system helps you meet POPIA's requirements; it doesn't replace understanding your own legal obligations under the Act. When in doubt on a specific request, ask your lawyer/accountant, not this document.

---

## Where to find it

Admin Dashboard → **Administration → Privacy & POPIA**. Also linked from **Administration → Admin Users** (session revocation) and **Administration → Audit Logs** (every privacy-related action is logged there too, action names starting `RESOLVE_DSR`, `UPDATE_RETENTION_POLICY`, `ANONYMIZE_CUSTOMER`, `RETENTION_SWEEP`).

Who can see what:
- **Administrator** — full access, including approving account-deletion requests and editing retention policy.
- **Shop Manager / Staff** — can view and triage the request queue (change status to "In Review", add notes) but cannot approve a deletion or change retention settings.
- **Auditor** — read-only across the whole module (and the whole admin portal).

## Handling a Data Subject Request

Customers submit these themselves from their account's **Privacy** tab, or you can act on one that arrives by email to `privacy@toca.co.za`.

| Type | What it means | What happens |
|---|---|---|
| **Access** / **Portability** | "Send me everything you have on me" | Self-service — the customer downloads it directly, no queue involvement. |
| **Objection** | "Stop marketing to me" | Applied immediately when submitted — no review needed. |
| **Correction** | "Something's wrong, fix it" | Lands in your queue as "Submitted." Read the details, make the fix wherever the data actually lives (order, address, etc.), then mark it Completed with a note on what you changed. |
| **Deletion** | "Delete my account" | Lands in your queue. Requires an **Administrator** to approve. |

To resolve any queued request: open **Privacy & POPIA**, find it in the table, click **Review**, set a status, add a note explaining what you did (the note is part of the record), save.

**Approving a deletion** anonymises the customer's name, email, and phone immediately and irreversibly — their orders and payment records stay in the system (required for tax record-keeping) but are no longer linked to a real, contactable person. There's no undo. If you're not sure a request is genuine (e.g. you can't verify it's really them), move it to "In Review" and contact the customer through a channel you trust before approving.

## Retention Policy

Five categories, each with a retention window and an "auto-purge" switch:

- **PayFast Webhook Logs** — 365 days, auto-purge on.
- **Unsubscribed Newsletter Subscribers** — 90 days after they unsubscribe, auto-purge on.
- **Admin Audit Logs** — 3 years, auto-purge off (kept longer deliberately — useful if a dispute surfaces well after the fact).
- **Proof-of-Payment Files** — 5 years, auto-purge off (can show a customer's bank details; review manually before ever turning this on).
- **Orders & Financial Records** — 5 years, matches South African tax record-keeping requirements. This one is for visibility, not an active job — there's no purge handler behind it, so turning its switch on does nothing yet (see Known Limitations).

Auto-purge runs once a day (03:00) and logs a summary to the audit log. Only an Administrator can change these settings.

## Consent Statistics

Shows, per purpose (marketing email, each cookie category, testimonial display), how many people have ever made a decision and how many currently have it granted. Read-only — this is for visibility, not editing; consent itself is changed by the customer (their Privacy tab, the cookie banner) or through a resolved Objection request.

## If an admin account is compromised

**Admin Users → Sign Out Everywhere** (the logout icon on that row) ends every active session for that account immediately, without deactivating it — they'll need to log in again, but the account itself keeps working. Deactivate the account too if the compromise looks serious.

## If you suspect a data breach

POPIA requires notifying the Information Regulator and affected people "as soon as reasonably possible" once you know personal information has been accessed or acquired by an unauthorised person. This module doesn't automate that step — it's a judgment call requiring:
1. Establishing what happened and what data was involved.
2. Notifying the Information Regulator (https://inforegulator.org.za).
3. Notifying affected customers directly, in a way that lets them protect themselves.

Get legal advice before doing this if you're not confident — the notification itself has requirements POPIA specifies.

## Known limitations / what's still manual

- **No Information Officer is registered or referenced yet.** POPIA requires every organisation to have one, registered with the Information Regulator. This is a real, separate action item for the business — not something this system can do for you. Once registered, their name/contact should be added to the Privacy Policy (`js/footer.js`) and this module can reference them in request confirmations.
- **Testimonial consent isn't in the consent ledger.** The submission form still requires the "may be displayed publicly" checkbox, but because testimonials don't collect an email address, there's no reliable way to link that consent to a specific person's record. Low risk (it's optional, visible-once-approved content), but worth knowing.
- **Orders & Financial Records retention has no active purge job** — the 5-year figure is documented for policy/audit purposes, but nothing will actually delete order data even if you flip auto-purge on for it. Deleting financial records automatically is a bigger, more consequential build than this pass covered (it interacts with invoicing, tax reporting, and refund history) — treat that switch as a placeholder until a developer wires up a real handler.
- **No malware/virus scanning on uploads** (proof-of-payment screenshots, testimonial photos). Files are validated by content signature (not just file extension), but not scanned for malicious content. Documented as a known gap, not fixed in this pass.
- **Correction requests are resolved by hand.** There's no automated "apply this fix" — an admin reads the request and makes the actual change wherever the data lives, then marks it resolved. This is intentional (an automated correction to arbitrary fields is a bigger risk than a person reading it), not an oversight.
