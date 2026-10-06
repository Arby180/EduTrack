# Deploy EduTrack through GitHub and Vercel

## GitHub

Create an empty private GitHub repository named `edutrack`. Do not add a README or license during creation. Connect this local project to that repository, commit the source, and push `main`. Never upload `.env`; `.env.example` contains placeholders only.

## Import into Vercel

Sign into Vercel with GitHub, choose **Add New > Project**, and import the repository. Allow Vercel access to this repository. Use the **Next.js** preset, root directory `./`, build command `npm run build`, and the default output directory. Do not run database seeding or migrations as the build command.

Add these environment variables using the private values from your local configuration:

| Name | Production value |
| --- | --- |
| `DATABASE_URL` | Supabase pooled PostgreSQL connection string. For serverless deployments, use the transaction pooler connection from Supabase Connect. The app already disables prepared statements. |
| `AUTH_SECRET` | A strong private authentication secret; keep it stable across deployments. |
| `AUTH_GOOGLE_ID` | Google OAuth web client ID. |
| `AUTH_GOOGLE_SECRET` | Current Google OAuth client secret. |
| `AUTH_URL` | Your stable production origin, such as `https://your-project.vercel.app`, never localhost. Required for confirmation email links. |
| `RESEND_API_KEY` | Resend key used for sending email and reading delivery status. |
| `EMAIL_FROM` | Verified sending address. The Resend test sender only supports restricted test recipients. |

Set production credentials for **Production**. Do not automatically share the live school database with untrusted preview deployments. Do not set `NODE_ENV` or `SKIP_ENV_VALIDATION`. Twilio variables are optional if SMS is unused.

Deploy to obtain the assigned domain, then set `AUTH_URL` to that exact domain and redeploy if necessary. Environment variable changes apply to new deployments.

## Google OAuth

In Google Auth Platform > Clients > your web client, add:

- Authorized JavaScript origin: `https://your-project.vercel.app`
- Authorized redirect URI: `https://your-project.vercel.app/api/auth/callback/google`

Keep localhost entries for local development. If the OAuth app is in testing, add the intended Google accounts as test users. Use the stable production domain for sign-in, not changing preview URLs.

## Before sharing the site

- Replace or deactivate known demo accounts, especially the seeded administrator whose password is in the demo documentation. Keep access to a working administrator account before disabling the demo administrator.
- Use fresh credentials for any secret previously shared in screenshots. Store secrets only in local `.env` and Vercel environment settings.
- The existing Supabase database is reused when you supply its URL; school records will be live. Do not run `db:seed` against it during deployment.
- Check the landing page, school login modal, Google role-based login, logout, and email confirmation links on the production URL.
- Confirm guardian email delivery using an authorized recipient and verified sender configuration.

## References

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
