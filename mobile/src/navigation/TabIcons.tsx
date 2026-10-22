import React from 'react';
import { Text } from 'react-native';

type TabIconProps = { color: string };

const iconStyle = (color: string) => ({ color, fontSize: 24 });

export function HomeIcon({ color }: TabIconProps) {
  return <Text style={iconStyle(color)}>🏠</Text>;
}

export function WasteIcon({ color }: TabIconProps) {
  return <Text style={iconStyle(color)}>♻️</Text>;
}

export function ProfileIcon({ color }: TabIconProps) {
  return <Text style={iconStyle(color)}>👤</Text>;
}
