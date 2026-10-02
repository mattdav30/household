import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayWidget } from './TodayWidget';
import { loadWidgetData } from './data';

/** Runs in the background when Android adds, refreshes or resizes the widget. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const { data, message } = await loadWidgetData();
      props.renderWidget({
        light: <TodayWidget data={data} message={message} mode="light" />,
        dark: <TodayWidget data={data} message={message} mode="dark" />,
      });
      break;
    }
    default:
      break;
  }
}
