---
description: SAFE & CONSISTENT FULL-STACK IMPLEMENTATION RULES
---

You are building and modifying a production-grade eCommerce system. For EVERY instruction or feature update, you MUST follow ALL rules below before producing output.

---

1. FULL-STACK IMPACT ANALYSIS (MANDATORY)

---

Before writing any code, you MUST:

* Identify ALL layers affected:

  * Database (tables, fields, relationships)
  * Backend (routes, controllers, business logic)
  * Frontend (UI components, forms, state)
* Explicitly state what will change in each layer

DO NOT proceed unless all layers are accounted for.

---

2. DATABASE INTEGRITY & ACCURACY

---

* ALWAYS use correct table names and field names exactly as defined in the schema

* NEVER invent fields that do not exist

* If new fields are required:

  * Clearly define them
  * Update Prisma schema accordingly

* Ensure:

  * Proper relationships (foreign keys)
  * Data types are correct
  * No duplication or inconsistency

* ALL write operations MUST:

  * Target the correct tables
  * Use validated and sanitized data
  * Maintain referential integrity

---

3. BACKEND LOGIC CORRECTNESS

---

* ALL business logic MUST be implemented on the backend (NOT frontend)

* NEVER trust frontend data (especially price, totals, stock)

* Ensure:

  * Correct API routes are used (RESTful structure)
  * Proper HTTP methods (GET, POST, PATCH, DELETE)
  * Input validation is enforced
  * Error handling is implemented

* CRITICAL:

  * Recalculate totals on server
  * Validate stock before processing orders
  * Use transactions where data consistency is required

---

4. FRONTEND ↔ BACKEND SYNCHRONIZATION

---

* Every frontend feature MUST:

  * Be connected to a real backend endpoint
  * Send and receive correct data structures

* Ensure:

  * API endpoints exist before calling them
  * Request payloads match backend expectations
  * Responses are handled correctly in UI

* The frontend MUST:

  * Reflect real backend data (no hardcoding)
  * Update dynamically after any action (CRUD)

---

5. UI & DATA CAPTURE COMPLETENESS

---

* Every database field that requires input MUST have:

  * A corresponding UI input element

* Ensure:

  * Forms capture ALL required fields
  * Field names match backend expectations
  * Validation exists (required, format, ranges)

* UI must:

  * Be usable and accessible
  * Prevent invalid submissions

---

6. CONSISTENT DATA FLOW (END-TO-END)

---

For every feature, verify this flow:

User Input → Frontend Form → API Request → Backend Logic → Database → Backend Response → Frontend Update

* If ANY part is missing → FIX before proceeding

---

7. SECURITY ENFORCEMENT (NON-NEGOTIABLE)

---

* ALL protected routes MUST:

  * Require JWT authentication
  * Enforce role-based access (ADMIN / SHOP_MANAGER)

* NEVER expose:

  * Sensitive data
  * Internal logic
  * Payment details

* ALWAYS:

  * Validate inputs
  * Sanitize data
  * Prevent unauthorized actions

---

8. ERROR HANDLING & EDGE CASES

---

* Handle ALL failure scenarios:

  * Invalid input
  * Missing data
  * API failure
  * Network errors

* Provide:

  * Meaningful error messages
  * Safe fallbacks in UI

---

9. NO ASSUMPTIONS RULE

---

* DO NOT assume:

  * Fields exist
  * APIs exist
  * Data structures are correct

* ALWAYS verify or explicitly define them

---

10. TESTING REQUIREMENTS (MANDATORY)

---

After implementing any feature, you MUST:

* Provide test scenarios:

  * Normal flow
  * Edge cases
  * Failure cases

* Ensure:

  * Data consistency
  * UI updates correctly
  * No breaking changes

---

11. CODE QUALITY & STRUCTURE

---

* Write clean, modular, maintainable code
* Avoid duplication
* Use clear naming conventions
* Keep frontend, backend, and database responsibilities aligned
* Always test and make sure that it works before you confirm completion.

---

FINAL RULE:
If ANY of the above conditions are not satisfied, DO NOT produce final code. Instead, fix the gaps first.
