import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import WasteSubmissionScreen from '../screens/WasteSubmissionScreen';
import TransferScreen from '../screens/TransferScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StatsScreen from '../screens/StatsScreen';
import { HomeIcon, WasteIcon, ProfileIcon } from './TabIcons';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

export function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Statistics' }} />
    </Stack.Navigator>
  );
}

export function WasteStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="WasteMain" component={WasteSubmissionScreen} options={{ title: 'Submit Waste' }} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Transfer Waste' }} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Waste"
        component={WasteStack}
        options={{
          tabBarLabel: 'Waste',
          tabBarIcon: ({ color }) => <WasteIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
