import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { MOTION, reduceMotion } from '../lib/motion';

/**
 * Fades and lifts content in when it first mounts, staggered by index,
 * so a screen's sections arrive in reading order.
 */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: ViewStyle | ViewStyle[] }) {
  const skip = reduceMotion();
  const v = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) return;
    Animated.timing(v, {
      toValue: 1,
      duration: MOTION.enter,
      delay: Math.min(index, MOTION.maxStagger) * MOTION.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index, skip]);
  return (
    <Animated.View style={[style as ViewStyle, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A quick spring pop, for confirming an action like ticking an item. */
export function usePop() {
  const s = useRef(new Animated.Value(1)).current;
  const pop = () => {
    if (reduceMotion()) return;
    s.setValue(0.75);
    Animated.spring(s, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start();
  };
  return { scale: s, pop };
}
