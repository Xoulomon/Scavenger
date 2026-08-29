import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../App';
import { useAppStore } from '../store/appStore';
import { mockParticipant, mockStats } from './fixtures/mockData';

describe('App Launch and Navigation Smoke Tests', () => {
  beforeEach(() => {
    // Reset the Zustand store before each test
    useAppStore.setState({
      participant: null,
      stats: null,
    });
  });

  test('app launches and renders home screen with default state', async () => {
    const { getByText } = render(<App />);
    await waitFor(() => {
      expect(getByText('Welcome, User')).toBeTruthy();
      expect(getByText('Participant')).toBeTruthy();
    });
  });

  test('renders custom participant details when state is loaded', async () => {
    useAppStore.setState({
      participant: mockParticipant,
      stats: mockStats,
    });

    const { getByText } = render(<App />);
    await waitFor(() => {
      expect(getByText('Welcome, Alice Recycler')).toBeTruthy();
      expect(getByText('Recycler')).toBeTruthy();
      expect(getByText('124.5 kg')).toBeTruthy();
      expect(getByText('250 pts')).toBeTruthy();
    });
  });

  test('tab navigation works correctly', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);

    // Verify starting screen is Home
    await waitFor(() => {
      expect(getByText('Welcome, User')).toBeTruthy();
    });

    // Navigate to Waste tab by pressing tab button
    const wasteTab = getByText('Waste');
    fireEvent.press(wasteTab);

    // Verify Waste screen renders (has unique input placeholder)
    await waitFor(() => {
      expect(getByPlaceholderText('Waste Type (e.g., Plastic, Metal, Paper)')).toBeTruthy();
    });

    // Navigate to Profile tab by pressing tab button
    const profileTab = getByText('Profile');
    fireEvent.press(profileTab);

    // Verify Profile screen renders
    await waitFor(() => {
      expect(getByText('Profile management coming soon')).toBeTruthy();
    });
  });

  test('stack navigation works correctly within HomeStack', async () => {
    const { getByText } = render(<App />);

    // Verify we are on Home Screen
    await waitFor(() => {
      expect(getByText('Welcome, User')).toBeTruthy();
    });

    // Navigate to Statistics screen via button on HomeScreen
    const viewStatsBtn = getByText('View Statistics');
    fireEvent.press(viewStatsBtn);

    // Verify Statistics screen is rendered
    await waitFor(() => {
      expect(getByText('Detailed statistics coming soon')).toBeTruthy();
    });
  });
});
