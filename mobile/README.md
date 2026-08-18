# Mobile (React Native / Expo)

This monorepo includes a pre-built Expo-managed React Native app in this
`mobile/` folder (Dashboard, Calendar, and Event detail screens backed by
the shared event logic module).

**Do not run `npx create-expo-app` here** — the app already exists. Running
that command again will scaffold an unrelated, empty project into a nested
folder (e.g. `mobile/my-app/`) instead of using this code.

To install and run:

```bash
cd mobile
npm install
npm start
```

Then scan the QR code with the Expo Go app on your phone, or press `a`/`i`
in the terminal to open an Android/iOS emulator.

## Configuration

Create a `mobile/.env` file (not committed) pointing at your backend:

```
EXPO_PUBLIC_API_BASE=http://<your-pc-ip>:8000
```

Use your machine's LAN IP (not `localhost`) so a physical device can reach
the backend. Make sure the backend is running (`docker compose up -d` from
the repo root) before starting the app.

## Expo Go version compatibility

Expo Go on your phone only supports one or two recent SDK versions. If you
see an SDK mismatch warning on launch, either upgrade this project's `expo`
version in `package.json` to match your installed Expo Go app, or install
an older/matching version of Expo Go. Check `mobile/package.json` for the
currently pinned SDK version.
