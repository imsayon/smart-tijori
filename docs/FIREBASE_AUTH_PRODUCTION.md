# Firebase authentication — production connection

The browser application is registered in Firebase project `cents-lab-32d71`, under web app `tijori`. Public Firebase browser settings initialize email/password or Google sign-in. They are **not** credentials to verify sessions on Render.

## Private server credentials

To enable trusted Next.js sessions, configure **one** private identity source in Render's service environment:

- `ST_FIREBASE_SERVICE_ACCOUNT_JSON`: the full Firebase Admin service-account JSON from the same project. Never use `NEXT_PUBLIC_`.
- Alternatively `GOOGLE_APPLICATION_CREDENTIALS`: the absolute path to a secret-mounted service-account JSON, or an available workload identity.

Generate an Admin service account through Firebase Console → Project settings → **Service accounts**, with the project owner's approval. Keep it outside GitHub, screenshots, and chat. If an Admin key is ever exposed, rotate it. The public `NEXT_PUBLIC_ST_FIREBASE_API_KEY` is *not* a substitute for Admin credentials.

The server uses `ST_FIREBASE_PROJECT_ID=cents-lab-32d71`. Verify the client variables `NEXT_PUBLIC_ST_FIREBASE_API_KEY`, `NEXT_PUBLIC_ST_FIREBASE_AUTH_DOMAIN=cents-lab-32d71.firebaseapp.com`, and `NEXT_PUBLIC_ST_FIREBASE_PROJECT_ID=cents-lab-32d71` are available at build time. Changing build-time variables requires a new Render build.

## Provider configuration

In Firebase Console → Authentication → **Sign-in method**, enable Email/Password and Google as required. Set a valid project support email for Google. In Authentication → **Settings → Authorized domains**, add `smart-tijori.onrender.com`, plus any real custom domain. Test both email verification and Google popup on the deployed origin.

## Auth boundary

`POST /api/account/session` validates origin, verifies a recent Firebase ID token, checks verified email, and creates an eight-hour HttpOnly, Secure, SameSite=Lax session cookie. Invalid credentials get HTTP 401; missing credentials/provider failure gets HTTP 503. `GET /api/account/session` provides safe authenticated status. `DELETE` clears the account cookie and issues a new anonymous shopper session. Guest cart reconciliation is explicit on conflict.

Merchants use the same Firebase identity but get operations access **only** if an admin has inserted their actual Firebase UID and assigned store into the database `operator_memberships` table with `active = true`. Do not invent merchants or automatically grant all registered users access. An authorization failure returns 403; a missing table or missing SELECT privilege returns 503.

The production database role `st_storefront_verify` must receive a **narrow SELECT grant** on `st_platform_verify_v1.operator_memberships` from an authorized database administrator. **Do not** grant broad database owner rights or reuse an administrator credential in the app. Existing storefront role permissions for inventory writes require a separate review for checkout; do not conflate them with auth.

## Release verification checklist

1. Register/verify a dedicated email test account. Confirm sign-in, cookie issuance, session GET, browser reload, sign-out, and password reset.
2. Test Google popup from the real Render domain. Confirm email and Google use the same server session, and denied/blocked domains show actionable messages.
3. Confirm an ordinary shopper cannot enter `/ops`, cannot access merchant inventory endpoints, and cannot bypass authorization with request parameters.
4. Explicitly provision one merchant's Firebase UID to one branch; verify the merchant can access only that branch, and deactivating membership revokes merchant privileges on next request.
5. Run `pnpm test:security`, `pnpm test:shopping`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Only label live provider behavior verified after exercising the actual deployed sessions.

## Known production boundary (22 Nov 2026)

Frontend Firebase configuration was added earlier, but no verified Firebase Admin secret or granted merchant membership was available in this integration. The live merchant membership table contained zero rows; the storefront role lacked SELECT. Therefore a passing code build **does not** establish production sign-in. No Admin credentials belong in this document.
