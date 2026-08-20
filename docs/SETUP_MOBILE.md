# Mobile App Setup (Expo / React Native)

This guide gets the mobile app (`mobile/`) running locally via Expo Go, and
talking to the same backend used by the web app.

## Prerequisites

- Node.js and npm installed (same as required for `web/`)
- The [Expo Go](https://expo.dev/client) app installed on your phone
  (free, from the App Store or Google Play)
- The backend + database running — see `docs/SETUP_WEB.md` for that; the
  mobile app talks to the same PHP API on port 8000

## First-Time Setup

The `mobile/` folder currently contains hand-written source files
(`App.js`, `src/`, `package.json`, `app.json`) but not yet the generated
Expo scaffolding (`node_modules`, native config files Expo manages). Install
dependencies to complete the setup:

```bash
cd mobile
npm install
```

## Configure the API Base URL

The mobile app reads its backend URL from an environment variable,
`EXPO_PUBLIC_API_BASE`, because `localhost` means something different on a
phone than on your dev machine:

- In the iOS Simulator or Android Emulator, `localhost` usually **does**
  reach your dev machine.
- On a **physical phone** running Expo Go, `localhost` refers to the phone
  itself — you must use your dev machine's LAN IP address instead.

1. Find your machine's LAN IP:
   - **Windows (PowerShell):** `ipconfig` — look for "IPv4 Address" under
     your active network adapter (usually starts with `192.168.` or `10.`)
   - **macOS/Linux:** `ifconfig` or `ip addr` — look for `inet` under your
     active interface (not `127.0.0.1`)

2. Create `mobile/.env` (this file is gitignored — do not commit it):

   ```
   EXPO_PUBLIC_API_BASE=http://192.168.1.23:8000
   ```

   Replace `192.168.1.23` with your actual LAN IP.

3. Make sure your backend's CORS settings and Docker port mapping allow
   connections from your phone's IP (the existing `docker-compose.yml`
   already publishes port 8000 on all interfaces via `ports: "8000:8000"`,
   so this should work without changes as long as your phone and computer
   are on the same Wi-Fi network).

## Running the App

```bash
cd mobile
npm start
```

This starts the Expo dev server and shows a QR code in your terminal.

- **On your phone:** open the Expo Go app and scan the QR code (Android:
  scan from within Expo Go; iOS: scan with the Camera app, which will
  prompt to open in Expo Go).
- **In a simulator:** press `i` (iOS Simulator) or `a` (Android Emulator)
  in the terminal running `npm start`, if you have Xcode or Android Studio
  installed.

## What's Implemented

- **Dashboard tab:** Overdue / Due Today / Upcoming / Active Events,
  matching the web dashboard's logic exactly (shared via `shared/eventLogic.js`)
- **Calendar tab:** month grid with category-colored dots, tap a day to see
  its events
- **Event detail screen:** add/edit event, toggle "Requires action" and
  (when editing) "Completed", manage sub-tasks
- **Light/dark mode toggle** in the Dashboard header, persisted locally

## Known Gaps vs. Web (Not Yet Ported)

- Week/Day calendar views (only Month view exists on mobile so far)
- "This month" event list sidebar section
- Outstanding sub-task preview directly on dashboard cards fetches on
  mount per-card, same N+1 pattern as web — see the optimizations backlog

## Troubleshooting

**"Network request failed" when the app tries to load events:**
Almost always the API base URL. Double check `mobile/.env` has your
current LAN IP (it changes if you reconnect to Wi-Fi or switch networks),
and that your phone and dev machine are on the same network.

**QR code won't scan / "Something went wrong":**
Try running `npm start -- --tunnel` instead of `npm start` — this routes
traffic through Expo's servers instead of requiring the same local
network, at the cost of extra latency. Useful if your network blocks
local device discovery.
