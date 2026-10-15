# Orva Android Release

## Before building

- Keep the Android package name `com.orva.familybook` fixed after the first Play Store release.
- Create an EAS project and confirm the `projectId` in `app.json` belongs to it.
- Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_PRIVACY_POLICY_URL` as EAS environment variables for both `preview` and `production`. The public URL and anon key are included in the app bundle; never add the service-role key.
- Apply the Supabase migration, deploy `delete-account`, configure email one-time codes and SMTP, and test sign-in before enabling cloud sync in a release build.
- Host the reviewed privacy policy and account-deletion page at public HTTPS URLs.
- Test both English and Tamil, notification scheduling and taps, biometric unlock, backup/restore, and a long family name on a real Android phone.
- Include both Noto font notices from `docs/licenses/` in the release's third-party notices whenever the app ships the bundled fonts. See `docs/FONTS.md` for the exact font variants.

## Build and install

Install or update EAS CLI:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Create an internal APK for phone testing:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Create the Play Store app bundle:

```powershell
npx eas-cli@latest build --platform android --profile production
```

EAS prints a build URL when the job is submitted. Download the preview APK from that build page and install it on the test phone. Download the production `.aab` from its build page for Play Console upload.

Submit the production build to the internal testing track as a draft:

```powershell
npx eas-cli@latest submit --platform android --profile production
```

Review and preserve signing credentials with:

```powershell
npx eas-cli@latest credentials --platform android
```

## Play Console checklist

- Confirm the app name, package name, icon, adaptive icon, and version.
- Complete the privacy policy, account-deletion link, Data safety form, content rating, store listing, and screenshots in English and Tamil.
- Upload the `.aab` to internal testing and verify the installed release build before production rollout.
- Keep the Supabase service-role key only in Supabase server-side secrets. Do not put it in `.env`, EAS app variables, or the client bundle.
- Verify that users can delete their account in the app and that a group with other members keeps its shared records.

Android exact-time reminders require `SCHEDULE_EXACT_ALARM`; availability and user control are managed by Android. Confirm reminders on the target device and explain the system setting if the device limits exact alarms.
