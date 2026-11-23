# Mobile App Guide

## Overview

The Scavenger mobile app provides iOS and Android users with a native interface to participate in the recycling platform.

## Features

### Home Screen

- Welcome message with participant name and role
- Quick statistics (total waste, rewards earned)
- Quick action buttons for common tasks
- Navigation to detailed statistics

### Waste Submission

- Submit waste materials with type and weight
- Real-time validation
- Confirmation feedback
- History of submissions

### Waste Transfer

- Transfer waste to other participants
- Search for recipient participants
- Add transfer notes
- Track transfer status

### Profile Management

- View participant information
- Update profile details
- Manage notification preferences
- View account settings

### Statistics

- Total waste submitted
- Total rewards earned
- Waste breakdown by type
- Monthly trends
- Leaderboard position

## Installation

### iOS

1. Install Xcode 14+
2. Run `npm run ios`
3. App opens in iOS Simulator

### Android

1. Install Android Studio
2. Set up Android emulator or connect device
3. Run `npm run build:android`
4. Install APK on device

## Configuration

Create `.env` file in mobile directory:

```
REACT_APP_API_URL=http://localhost:8080
REACT_APP_CONTRACT_ID=your_contract_id
REACT_APP_NETWORK=testnet
```

## Architecture

### State Management

Uses Zustand for global state:

- Participant information
- Statistics
- Cached data

### API Integration

Axios-based API client with:

- Automatic error handling
- Request/response interceptors
- Timeout management

### Navigation

React Navigation with:

- Bottom tab navigation
- Stack navigation for screens
- Deep linking support

## Permissions

### iOS

- Camera (for QR code scanning)
- Location (for waste submission)
- Notifications

### Android

- CAMERA
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- POST_NOTIFICATIONS

## Performance

- Lazy loading of screens
- Image optimization
- Efficient state updates
- Minimal re-renders

## Testing

```bash
npm test
```

Run specific test:

```bash
npm test -- HomeScreen.test.tsx
```

## Debugging

Enable debug mode:

```bash
REACT_APP_DEBUG=true npm start
```

View logs:

```bash
npx react-native log-ios
npx react-native log-android
```

## Troubleshooting

### App crashes on startup

- Clear cache: `npm start -- --reset-cache`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### API connection issues

- Check API_URL in .env
- Verify backend is running
- Check network connectivity

### Build errors

- Clear build cache: `npm run clean`
- Update dependencies: `npm update`
- Check Node.js version (16+)

## Release

### iOS Release

```bash
npm run build:ios
# Upload to App Store Connect
```

### Android Release

```bash
npm run build:android
# Upload to Google Play Console
```

## Support

For issues and feature requests, visit the main project repository.
