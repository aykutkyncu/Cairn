import { View } from 'react-native';

import { useTheme } from './theme-provider';

export type DividerProps = {
  /** Dikey boşluk. Varsayılan olarak boşluk eklenmez. */
  readonly spacing?: 'none' | 'sm' | 'md' | 'lg';
};

/** Görsel ayırıcı. Anlam taşımadığı için erişilebilirlik ağacından gizlenir. */
export function Divider({ spacing = 'none' }: DividerProps) {
  const theme = useTheme();
  const margin = spacing === 'none' ? 0 : theme.spacing[spacing];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ backgroundColor: theme.colors.rule, height: 1, marginVertical: margin }}
    />
  );
}
