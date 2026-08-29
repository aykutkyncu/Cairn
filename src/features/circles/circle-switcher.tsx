import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuthStore } from '@/features/auth';
import { MIN_TOUCH_TARGET, Sheet, Text, useTheme } from '@/ui';

import { roleLabel } from './circle-schema';
import { useActiveCircle } from './use-circles';

/**
 * Aktif çember değiştirici.
 *
 * Üst barda durur ve kullanıcının hangi kişinin bakımına baktığını her an
 * görünür kılar. Bu bir süs değildir: yanlış çemberde işaretlenen bir ilaç,
 * yanlış kişiye verilmiş sayılır.
 *
 * Tek çember varsa seçici açılmaz; yalnız ad gösterilir. Bir seçenek sunmak,
 * seçenek yokken kullanıcıyı boş bir listeyle karşılamaktan iyidir.
 */
export function CircleSwitcher() {
  const theme = useTheme();
  const { activeCircle, circles, isLoading } = useActiveCircle();
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <View style={{ justifyContent: 'center', minHeight: MIN_TOUCH_TARGET }}>
        <Text tone="muted" variant="caption">
          Çemberler yükleniyor
        </Text>
      </View>
    );
  }

  if (activeCircle === null) {
    return (
      <View style={{ justifyContent: 'center', minHeight: MIN_TOUCH_TARGET }}>
        <Text tone="muted" variant="caption">
          Çember yok
        </Text>
      </View>
    );
  }

  const canSwitch = circles.length > 1;

  return (
    <View>
      <Pressable
        accessibilityRole={canSwitch ? 'button' : 'text'}
        accessibilityLabel={`Aktif çember: ${activeCircle.careRecipientName}. Rolün: ${roleLabel(activeCircle.role)}`}
        {...(canSwitch ? { accessibilityHint: 'Başka bir çembere geçmek için dokun' } : {})}
        accessibilityState={{ expanded: isOpen }}
        disabled={!canSwitch}
        onPress={() => setIsOpen(true)}
        style={{ justifyContent: 'center', minHeight: MIN_TOUCH_TARGET }}
      >
        <Text variant="title">{activeCircle.careRecipientName}</Text>
        <Text tone="muted" variant="caption">
          {roleLabel(activeCircle.role)}
          {canSwitch ? ' · değiştirmek için dokun' : ''}
        </Text>
      </Pressable>

      <Sheet visible={isOpen} onClose={() => setIsOpen(false)} title="Çember seç">
        <View style={{ gap: theme.spacing.xs }}>
          {circles.map((circle) => (
            <Pressable
              key={circle.id}
              accessibilityRole="button"
              accessibilityLabel={`${circle.careRecipientName}. ${roleLabel(circle.role)}`}
              accessibilityState={{ selected: circle.id === activeCircle.id }}
              onPress={() => {
                setActiveCircleId(circle.id);
                setIsOpen(false);
              }}
              style={{
                backgroundColor:
                  circle.id === activeCircle.id ? theme.colors.surfaceSunk : theme.colors.surface,
                borderRadius: theme.radius.md,
                justifyContent: 'center',
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <Text>{circle.careRecipientName}</Text>
              <Text tone="muted" variant="caption">
                {roleLabel(circle.role)}
                {circle.id === activeCircle.id ? ' · seçili' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
