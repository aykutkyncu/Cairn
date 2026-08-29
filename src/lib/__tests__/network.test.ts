import { toNetworkStatus } from '../network';

/**
 * Ağ durumu testleri.
 *
 * Sözleşme: ağ TÜRÜ internet erişimini kanıtlamaz. Bu testler, bağlı ama
 * erişimsiz bir cihazın çevrimiçi sayılmadığını sabitler.
 */

describe('toNetworkStatus', () => {
  it('bağlantı yoksa çevrimdışıdır', () => {
    expect(toNetworkStatus({ isConnected: false, isInternetReachable: true })).toEqual({
      isOnline: false,
      isMeasured: true,
    });
  });

  it('bağlı ama internet erişimi yoksa çevrimdışıdır', () => {
    // Portal arkasındaki Wi-Fi: bağlı görünür, hiçbir isteği geçirmez.
    expect(toNetworkStatus({ isConnected: true, isInternetReachable: false })).toEqual({
      isOnline: false,
      isMeasured: true,
    });
  });

  it('erişilebilirlik ölçülmediyse çevrimiçi varsayar ve bunu işaretler', () => {
    // Kullanıcıyı yanlışlıkla "çevrimdışı" diye engellemek, denemekten kötüdür.
    expect(toNetworkStatus({ isConnected: true })).toEqual({
      isOnline: true,
      isMeasured: false,
    });
  });

  it('bağlı ve erişilebilirse çevrimiçidir', () => {
    expect(toNetworkStatus({ isConnected: true, isInternetReachable: true })).toEqual({
      isOnline: true,
      isMeasured: true,
    });
  });

  it('boş durumda çevrimdışı sayar', () => {
    expect(toNetworkStatus({})).toEqual({ isOnline: false, isMeasured: true });
  });
});
