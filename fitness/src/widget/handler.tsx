import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { JourneyWidget } from './JourneyWidget';
import { loadWidgetData } from './data';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const { data, message } = await loadWidgetData();
      props.renderWidget({
        light: <JourneyWidget data={data} message={message} mode="light" />,
        dark: <JourneyWidget data={data} message={message} mode="dark" />,
      });
      break;
    }
    default:
      break;
  }
}
