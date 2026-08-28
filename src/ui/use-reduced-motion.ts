import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Kullanıcının "hareketi azalt" sistem tercihini izler.
 *
 * Tercih okunamazsa güvenli tarafta kalınır ve hareket açık kabul edilmez;
 * varsayılan false'tur, fakat okuma başarısız olursa değer değişmez.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotion(enabled);
      })
      .catch(() => {
        // Tercih okunamadı; mevcut değer korunur. Hata kullanıcı verisi içermez.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotion(enabled);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
