// App entry: Expo Router, plus the background handler for the home screen widget.
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/handler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
