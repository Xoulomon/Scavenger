import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { render, waitFor } from '@testing-library/react-native';
import RootNavigator from '../navigation/RootNavigator';

describe('RootNavigator', () => {
  test('renders the Home, Waste and Profile tab labels', async () => {
    const { getAllByText, getByText } = render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => {
      // "Home" is both the tab label and the stack header title
      expect(getAllByText('Home').length).toBeGreaterThan(0);
      expect(getByText('Waste')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();
    });
  });
});
