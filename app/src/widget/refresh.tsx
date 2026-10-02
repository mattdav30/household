import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { TodayWidget } from './TodayWidget';
import { loadWidgetData } from './data';

let timer: ReturnType<typeof setTimeout> | null = null;

/** Redraws the home screen widget soon after something changes in the app. */
export function refreshWidgetSoon(delay = 1500) {
  if (Platform.OS !== 'android') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    const { data, message } = await loadWidgetData();
    requestWidgetUpdate({
      widgetName: 'Today',
      renderWidget: () => ({
        light: <TodayWidget data={data} message={message} mode="light" />,
        dark: <TodayWidget data={data} message={message} mode="dark" />,
      }),
      widgetNotFound: () => undefined,
    }).catch(() => undefined);
  }, delay);
}
