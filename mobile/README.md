# Mobile (React Native / Expo)

This monorepo uses a separate mobile project. To initialize an Expo-managed
React Native app, run:

```bash
cd mobile
npx create-expo-app .
# or from repo root:
npx create-expo-app mobile
```

After initialization, configure the app to talk to the backend at
`http://<your-pc-ip>:8000` for device testing, or use tunnels.

For development, use the Expo Go app or local emulators.
