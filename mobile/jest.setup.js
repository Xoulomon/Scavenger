// Jest mock configuration for React Native modules

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const mockContext = React.createContext(inset);
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    SafeAreaConsumer: mockContext.Consumer,
    SafeAreaContext: mockContext,
    SafeAreaInsetsContext: mockContext,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('react-native-screens', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    enableScreens: jest.fn(),
    ScreenContainer: View,
    Screen: View,
    ScreenStack: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
    SearchBar: View,
  };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const View = require('react-native').View;
  class MockMapView extends React.Component {
    render() {
      return React.createElement('MapView', this.props, this.props.children);
    }
  }
  class MockMarker extends React.Component {
    render() {
      return React.createElement('Marker', this.props, this.props.children);
    }
  }
  MockMapView.Marker = MockMarker;
  return MockMapView;
});

jest.mock('react-native-camera', () => {
  const React = require('react');
  const View = require('react-native').View;
  class MockRNCamera extends React.Component {
    render() {
      return React.createElement('RNCamera', this.props, this.props.children);
    }
  }
  MockRNCamera.Constants = {
    Type: { back: 'back', front: 'front' },
    FlashMode: { off: 'off', on: 'on', auto: 'auto', torch: 'torch' },
  };
  return { RNCamera: MockRNCamera };
});

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn().mockImplementation((success) =>
    success({
      coords: {
        latitude: 37.78825,
        longitude: -122.4324,
      },
    })
  ),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn().mockResolvedValue('granted'),
}));

// Mock Alert to prevent crashes during test runs
jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

// Mock NativeAnimatedHelper
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
