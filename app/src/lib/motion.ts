import { AccessibilityInfo, LayoutAnimation, Platform, UIManager } from 'react-native';

// Respect the phone's "Remove animations" setting everywhere.
let reduce = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduce = v; }).catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduce = v; });
export const reduceMotion = () => reduce;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Smoothly moves list rows when items are added, ticked or removed. */
export function animateList() {
  if (reduce || Platform.OS === 'web') return;
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.85 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}

/** Standard timings so every animation in the app feels related. */
export const MOTION = { enter: 260, stagger: 40, maxStagger: 8 };
