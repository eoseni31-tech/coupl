# PRIVATE COUPLE LEDGER — upload this project for couples

Suggested GitHub repository and Vercel project name: sgw-couple-ledger (subject to availability).
Example address only: https://sgw-couple-ledger.vercel.app/

The root URL shows the couple sign-in. After login, /couple shows the protected dashboard, guest responses and gift ledger. There is NO guest wedding invitation and NO guest submission endpoint in this package. Records are selected using the signed-in couple's database identity. There are no fake production records or pre-created accounts.

Additional Vercel variable for THIS project:

- GUEST_SITE_ORIGIN = the guest website's exact HTTPS origin with no trailing slash, for example https://YOUR-ACTUAL-GUEST-SITE.vercel.app

This origin is also required in your local private .env when generating guest invitation links. Use the actual assigned domain, not the example.

## Where the Turso credentials go

In Vercel, open THIS project → Settings → Environment Variables. Add:

- TURSO_DATABASE_URL = libsql://safiyahs-weddings-ella3638.aws-ap-south-1.turso.io
- TURSO_AUTH_TOKEN = your secret Turso database authentication token
- APP_ORIGIN = this project's exact HTTPS address with no trailing slash

Set these on BOTH projects. Use the same database URL. The same valid database token can connect both servers; separate appropriately scoped tokens may be used if you issue them. Tokens stay server-side. Do not paste tokens into the invitation, dashboard, GitHub files, or a website form. A Turso token is not the couple login password.

Set the final origin after Vercel assigns the address, then redeploy that project so the environment changes take effect. For a preview, set the exact preview origin and use a separately scoped test database. Never change the production database just to test a preview.

## Deploying manually

1. Extract this ZIP. Open its clearly named project folder.
2. Upload the CONTENTS of that folder to its own GitHub repository, preserving all folders. Include package.json, package-lock.json, vercel.json and server files. Do not upload only the HTML. Never upload .env or node_modules.
3. In Vercel choose Add New → Project and import that repository. Use the Other framework preset, Node 22 or later, npm ci install, npm run build, and the public output directory configured in vercel.json. Do not copy configuration from the earlier combined package.
4. Add the environment variables above. Approve deployment only when you want this project published. This deliverable has not been deployed.
5. Deployment alone does not create database tables, couple accounts or invitation records. Follow the couple project's one-time setup below before testing real submissions.

The servers communicate through the same database, not through cross-site browser requests. No CORS exceptions, shared-domain cookies or connection URL between the two sites is needed. The couple project additionally needs the guest origin to generate correct invitation links.

## Verification and limits

Build and HTTP/SQL tests passed locally for each separate project. A separate integration check used two live local servers and independent SQL connections to confirm that guest-site RSVPs and gift notifications appear in the couple-site ledger. The original invitation CSS and embedded media are preserved. No live Turso connection, Vercel deployment, browser layout or real payment verification has been tested. No production data was changed.

Gift declarations are unverified reports, not proof of payment. Registry choices reserve an item. The guest website now links to https://paystack.shop/pay/bgtkmsmy8c for monetary gifts and cash contributions towards listed items. No Paystack API/webhook verification is configured, and no route allows a guest to mark gifts paid. Existing sample bank details remain samples. Photo uploads, livestream, asoebi contact and payment destinations remain unconfigured where they were unconfigured in your original page.

Authentication uses scrypt password hashes, random database-backed sessions, HttpOnly/Secure/SameSite cookies, exact-origin write checks and server-side wedding ownership checks. Queries are parameterized, input is validated, rate limits persist in SQL, and logout revokes the session. This is not an independent security audit.

For local development: npm ci; copy .env.example to .env; use only real credentials privately or explicitly enable LOCAL_DATABASE_URL for local-only testing. npm test runs isolated SQL fixtures and does not use your Turso credentials. npm run build performs syntax/configuration checks; no frontend bundler is needed.

## One-time database and account setup — run from the couple project only

This requires Node 22 or later on your computer, or a trusted private development terminal. Keep credentials in a local .env file excluded from Git. A Vercel website form cannot perform this setup.

1. Run npm ci in the SGW-Couple-Ledger folder.
2. Copy .env.example to .env. Privately set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, APP_ORIGIN to the ledger origin, and GUEST_SITE_ORIGIN to the guest origin.
3. Inspect/back up any existing database before running npm run migrate. This command adds prefixed sgw_ tables and indexes; it does not delete existing tables. For a remote database it asks you to type APPLY. No migration has been run for you. Existing records in unrelated tables are not automatically imported.
4. Review wedding-details.json; the dates/venues copied from the original invitation are explicitly SAMPLE details. Then run:

   npm run manage -- create-couple your-email@example.com chioma-henry "Chioma & Henry" wedding-details.json

   The terminal asks for a hidden password of at least 12 characters. This creates the couple login; no email is sent. Save the wedding ID printed by the command.
5. Create a guest invitation:

   npm run manage -- invite WEDDING_ID "Guest Name" 2

   Replace WEDDING_ID with the real printed ID. The final number is the total party allowance, including that guest. The generated URL uses GUEST_SITE_ORIGIN, not the private ledger URL. Share each personal link privately. The guest site root can be viewed without a token, but submissions require a valid personal invitation link. Guest access survives refresh via an HttpOnly cookie, and every request checks invitation revocation.
6. Sign in on the ledger's root URL with the email/password created in step 4. Submit a guest RSVP and gift notification through the guest link, then refresh the ledger. Repeat with a second account to verify isolation before launch.

Operator tools:

- npm run manage -- reset-password couple@example.com (hidden password prompt; revokes all existing sessions)
- npm run manage -- revoke-invite INVITATION_ID
- npm run manage -- cleanup (remove expired sessions and rate-limit rows)

There is no passkey/WebAuthn login implementation. The couple password is hashed in the database, not stored as a Vercel environment variable. Turso's database token is a different credential.

The supplied guest page is specifically Chioma & Henry's invitation. Database authorization supports multiple couples, but additional couples need their own matching invitation content and deployment before issuing their guest links. Do not send another couple's links against the Chioma & Henry page.

## Payment link update

The guest website uses the supplied Paystack page https://paystack.shop/pay/bgtkmsmy8c. It was observed displaying Wedding / BY HEALTHAURA SKIN. No payout destination or subaccount assignment was inspected or changed. You remain responsible for configuring and checking the intended payout destination in Paystack.

The spray button and monetary gift link open that page; each registry item also offers Contribute via Paystack alongside Reserve this gift. Contributions are cash funding; this does not order an item or arrange delivery. The guest can return to the notification form, select the item, and report an amount/reference. Those notifications and reservations persist to the shared database and are visible in the couple ledger after refreshing.

Opening or returning from this external link does not automatically associate or verify a Paystack transaction. The supplied page has no website-generated invitation reference in its configuration here. No API key or webhook configuration was supplied. Automatic Paid updates therefore remain pending a secure Paystack integration that maps each transaction to its invitation/wedding and verifies the transaction amount, currency, reference and recipient configuration. Never associate incoming payments to a couple solely by donor name or amount, and never mark a notification paid solely because a link was opened.

Required for a future automatic integration: the appropriate server-side Paystack secret key configured privately as PAYSTACK_SECRET_KEY in Vercel (not GitHub/HTML/chat), the final guest-site domain for the webhook/callback settings, and a transaction-to-wedding association. A public payment URL alone supplies none of these. This release adds the requested link and shared gift-purpose reporting; it does not claim to implement verified-payment syncing.
