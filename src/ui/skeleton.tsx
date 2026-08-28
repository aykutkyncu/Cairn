import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useReducedMotion } from './use-reduced-motion';

import { useTheme } from './theme-provider';

export type SkeletonProps = {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly radius?: 'sm' | 'md' | 'pill';
  /** Ekran okuyucuya iletilecek yükleniyor açıklaması. */
  readonly accessibilityLabel?: string;
};

const PULSE_DURATION_MS = 900;
const MIN_OPACITY = 0.4;
const MAX_OPACITY = 0.85;

/**
 * Yükleme yer tutucusu.
 *
 * prefers-reduced-motion açıkken nabız animasyonu çalışmaz, sabit bir yüzey gösterilir.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'sm',
  accessibilityLabel,
}: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  // Animated.Value bir kez oluşturulur; render sırasında ref okumamak için state kullanılır.
  const [opacity] = useState(() => new Animated.Value(MIN_OPACITY));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(MIN_OPACITY);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  const content = (
    <Animated.View
      style={{
        backgroundColor: theme.colors.surfaceSunk,
        borderRadius: theme.radius[radius],
        height,
        opacity,
        width,
      }}
    />
  );

  if (accessibilityLabel === undefined) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {content}
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar">
      {content}
    </View>
  );
}
