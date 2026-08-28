import { Modal, Pressable, ScrollView, View, type ModalProps } from 'react-native';

import { Button } from './button';
import { Text } from './text';
import { useTheme } from './theme-provider';

export type SheetProps = Pick<ModalProps, 'onRequestClose'> & {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  /** Kapatma düğmesinin erişilebilir adı. */
  readonly closeLabel?: string;
};

/**
 * Alttan açılan panel.
 *
 * İçerik kaydırılabilir; sabit yükseklik verilmediği için en büyük yazı boyutunda
 * da metin kırpılmaz. Arka plandaki karartmaya dokunmak paneli kapatır.
 */
export function Sheet({ visible, title, onClose, children, closeLabel = 'Kapat' }: SheetProps) {
  const theme = useTheme();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel={closeLabel}
        accessibilityRole="button"
        onPress={onClose}
        style={{ backgroundColor: theme.colors.scrim, flex: 1 }}
      />

      <View
        accessibilityViewIsModal
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            gap: theme.spacing.md,
            maxHeight: '80%',
            padding: theme.spacing.xl,
          },
          theme.elevation.sheet,
        ]}
      >
        <Text accessibilityRole="header" variant="title">
          {title}
        </Text>

        <ScrollView contentContainerStyle={{ gap: theme.spacing.md }}>{children}</ScrollView>

        <Button label={closeLabel} onPress={onClose} variant="secondary" />
      </View>
    </Modal>
  );
}
