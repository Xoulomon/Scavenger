# Scavenger Mobile App

## Overview
The Scavenger mobile app provides a native experience for waste management tracking and rewards.

## Architecture

### Technology Stack
- **Framework:** React Native with Expo
- **State Management:** Zustand
- **Navigation:** React Navigation
- **API Client:** Axios
- **Offline Storage:** AsyncStorage
- **Push Notifications:** Expo Notifications
- **Security:** Expo SecureStore, Biometric Authentication

### Directory Structure
name: Mobile Build
on:
  push:
    paths:
      - 'mobile/**'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd mobile && npm install
      - run: cd mobile && npm test
