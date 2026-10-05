import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { PetWidget } from './PetWidget';
import { loadWidgetData } from './data';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const { data, message } = await loadWidgetData();
      props.renderWidget({
        light: <PetWidget data={data} message={message} mode="light" />,
        dark: <PetWidget data={data} message={message} mode="dark" />,
      });
      break;
    }
    default:
      break;
  }
}
