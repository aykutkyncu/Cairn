import * as Network from 'expo-network';
import { onlineManager } from '@tanstack/react-query';

import { logger } from './logger';

/**
 * Ağ durumu.
 *
 * **Ağ türü internet erişimini kanıtlamaz.** Cihaz Wi-Fi'a bağlıyken portal
 * arkasında, uçuş modunda bir hotspot'a bağlıyken veya sinyalsiz bir hücresel
 * hücrede olabilir. Bu yüzden çevrimiçi sayılmak için `isInternetReachable`
 * açıkça `true` olmalıdır; `isConnected` tek başına yeterli değildir.
 *
 * `isInternetReachable` bazı platformlarda `undefined` döner (henüz
 * ölçülmemiş). Bu durumda bağlantı VAR sayılır: kullanıcıya "çevrimdışısın"
 * demek, aslında çevrimiçiyken yazmayı engellemekten daha kötüdür — istek
 * yine de denenir ve gerçek hata kendini gösterir.
 */

export type NetworkStatus = {
  readonly isOnline: boolean;
  /**
   * Erişilebilirlik gerçekten ölçüldü mü?
   *
   * Arayüz, ölçülmemiş bir durumu "çevrimdışı" diye sunmamalıdır.
   */
  readonly isMeasured: boolean;
};

/** Bir `expo-network` durumunu uygulamanın çevrimiçi tanımına indirger. */
export const toNetworkStatus = (state: {
  readonly isConnected?: boolean | undefined;
  readonly isInternetReachable?: boolean | undefined;
}): NetworkStatus => {
  const isConnected = state.isConnected === true;
  const reachable = state.isInternetReachable;

  if (!isConnected) return { isOnline: false, isMeasured: true };
  if (reachable === undefined) return { isOnline: true, isMeasured: false };

  return { isOnline: reachable, isMeasured: true };
};

/**
 * TanStack Query'nin çevrimiçi yöneticisini cihazın ağ durumuna bağlar.
 *
 * @returns Aboneliği sonlandıran fonksiyon.
 */
export const startNetworkWatcher = (): (() => void) => {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      const status = toNetworkStatus(state);
      logger.debug('network_state_changed', {
        isOnline: status.isOnline,
        isMeasured: status.isMeasured,
      });
      setOnline(status.isOnline);
    });

    // İlk durum dinleyici kurulmadan önce oluşmuş olabilir; bir kez okunur.
    void Network.getNetworkStateAsync()
      .then((state) => setOnline(toNetworkStatus(state).isOnline))
      .catch(() => {
        // Ağ durumu okunamıyorsa çevrimiçi varsayılır; isteğin kendisi
        // gerçek durumu ortaya çıkarır.
        setOnline(true);
      });

    return () => subscription.remove();
  });

  return () => onlineManager.setEventListener(() => () => undefined);
};
