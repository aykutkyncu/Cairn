import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Uygulamanın çevrimiçi olup olmadığını döndürür.
 *
 * Kaynak, TanStack Query'nin `onlineManager`'ıdır; böylece arayüzün gördüğü
 * durum ile sorguların davrandığı durum aynıdır. İkinci bir ağ dinleyicisi
 * kurmak, ikisinin ayrışabildiği bir pencere yaratırdı.
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  return isOnline;
};
