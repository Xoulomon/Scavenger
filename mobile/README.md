# Scavenger Mobile App

> ⚠️ **Status: Unmaintained / Archived**
>
> This directory contains scaffolding from an earlier mobile initiative.
> It is **not actively maintained**, is **not built or tested in CI**, and
> is **not part of any current release**.
>
> **Do not use this code in production.**
> **Do not add new features here.**
>
> If you want to revive the mobile app, please open an issue titled
> `[Proposal] Revive mobile app` describing scope, tech stack, and
> maintenance plan, and wait for maintainer approval before writing code.

---

# Scavenger Mobile App

React Native mobile application for iOS and Android platforms.

## Features

- **Waste Submission**: Submit waste materials with type and weight
- **Waste Transfer**: Transfer waste between participants
- **Statistics**: View personal recycling statistics and rewards
- **Profile Management**: Manage participant profile and settings
- **Real-time Updates**: Receive notifications for waste transfers and rewards

## Setup

Prerequisites, environment variables, and first-time setup for the mobile app are in
the canonical guide:

➡️ **[Developer Onboarding Guide — Mobile](../docs/DEVELOPER_ONBOARDING.md#mobile-mobile)**

The mobile app talks to the backend and the deployed contract, so bring the rest of
the stack up first — that is covered in the same guide.

## Development

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

### Start Metro Bundler
```bash
npm start
```

## Building

### iOS Release Build
```bash
npm run build:ios
```

### Android Release Build
```bash
npm run build:android
```

## Project Structure

```
src/
├── App.tsx              # Main app component with navigation
├── screens/             # Screen components
│   ├── HomeScreen.tsx
│   ├── WasteSubmissionScreen.tsx
│   ├── TransferScreen.tsx
│   ├── ProfileScreen.tsx
│   └── StatsScreen.tsx
├── api/                 # API client
│   └── wasteApi.ts
├── store/               # State management (Zustand)
│   └── appStore.ts
└── types/               # TypeScript types
```

## Environment Variables

See [Developer Onboarding — Environment Variables](../docs/DEVELOPER_ONBOARDING.md#environment-variables).

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
```

## Contributing

See the main project CONTRIBUTING.md for guidelines.

## License

MIT
