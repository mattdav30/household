import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { PetWidget } from './PetWidget';
import { loadWidgetData } from './data';

let timer: ReturnType<typeof setTimeout> | null = null;

export function refreshWidgetSoon(delay = 1500) {
  if (Platform.OS !== 'android') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    const { data, message } = await loadWidgetData();
    requestWidgetUpdate({
      widgetName: 'Pet',
      renderWidget: () => ({
        light: <PetWidget data={data} message={message} mode="light" />,
        dark: <PetWidget data={data} message={message} mode="dark" />,
      }),
      widgetNotFound: () => undefined,
    }).catch(() => undefined);
  }, delay);
}
