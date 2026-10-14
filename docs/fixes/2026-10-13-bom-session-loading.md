# BOM data missing after sign-in

## Cause

`AppDataProvider` mounts outside the authenticated routes. Its BOM hook ran its
initial queries and opened Realtime subscriptions before Firebase had restored
the session, then never reran when the user became available. Production logs
showed anonymous BOM requests returning HTTP 401 followed by authenticated user
and engineering-project requests returning HTTP 200. Revoking anonymous access
exposed this existing startup race.

## Correction

- Wait until `useAuth().loading` is false and a user UID is present.
- Reload projects, catalog, materials, and managed lists when the session changes.
- Clear cached BOM data on logout/account changes.
- Abort pending reads and ignore late responses from the previous session.
- Give each Realtime subscription a unique topic, because removing a channel is
  asynchronous and Supabase otherwise reuses an existing topic.
- Preserve pagination, data mappings, CRUD behavior, and database permissions.

This is the targeted BOM repair requested by the owner, not a general change to
the protected modules in the audit-remediation roadmap. There are no SQL,
permission, user-account, or Cloud Functions changes.

## Verification

Six React hook regression tests cover signed-out startup, delayed login, loading
with a restored user, pagination/Realtime, logout/login, and stale requests after
an account change. Four tests failed against the original implementation; all
six pass after the fix. The complete suite passes: **271 tests in 16 files**.

The production build succeeds using the existing public frontend configuration.
The edited hook and test file pass ESLint and the diff passes whitespace checks.
The repository-wide lint run still reports 278 errors and 40 warnings in
unrelated, unchanged files. The build retains existing XLSX-export and chunk-size
warnings; these are outside this session-loading fix.

An authenticated production browser check must follow Hosting publication. Local
React tests use simulated auth/API responses and do not replace that check.

## Release

Build with the existing `VITE_FIREBASE_API_KEY`, `VITE_SUPABASE_URL`, and public
`VITE_SUPABASE_ANON_KEY` configuration, then deploy **Hosting only** for
`bom-ame-cr`. The build supports the project's existing Node versions; jsdom
26.1.0 is pinned as a test-only dependency.

After publication, open the app with a restored session and with a fresh login.
Confirm that projects, catalog, and BOM items populate without reloading, and
that the initial protected requests are authenticated. Keep anonymous access
disabled. No database migration is needed.

### Publish from a phone using Google Cloud Shell

If the Firebase plugin cannot be installed, open the standard
[Cloud Shell terminal](https://shell.cloud.google.com/?project=bom-ame-cr&show=terminal)
with the Google account that owns this Firebase project. Authorize Cloud Shell
when Google asks. Do not use the `cloudshell_git_repo` URL parameter: Google
opens non-allowlisted repositories in an environment without account credentials.

From the repository, run:

```bash
node scripts/deploy-hosting-cloud-shell.mjs
```

The helper verifies that the BOM fix is present, reads only the existing public
frontend configuration from the deployed application, installs locked dependencies,
builds, and deploys **Hosting only** to `bom-ame-cr`. Keys are passed directly to
the build environment; they are not printed or written to a file. It stops before
deployment if configuration is missing or ambiguous. Google credentials remain
inside Cloud Shell. It does not change database permissions or user accounts.

`--check-config` verifies configuration without installing, building, or deploying.
`--build-only` verifies configuration and builds without deployment. Production
access remains to be verified after the owner completes Google authorization and
the deployment succeeds.
