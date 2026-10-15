// App entry: Expo Router, plus the background handler for the home screen widget.
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/handler';
// GPS tracking keeps recording with the screen off; the background task has to be registered at start up.
import './src/lib/gps';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
