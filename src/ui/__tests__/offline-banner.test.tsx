import { render } from '@testing-library/react-native';

import { OfflineBanner } from '../offline-banner';
import { ThemeProvider } from '../theme-provider';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);

describe('OfflineBanner', () => {
  it('çevrimiçiyken hiçbir şey göstermez', async () => {
    const { toJSON } = await wrap(<OfflineBanner isOffline={false} />);

    expect(toJSON()).toBeNull();
  });

  it('çevrimdışıyken durumu metinle söyler', async () => {
    // Anlam renkle taşınmaz: metin durumu açıkça söyler.
    const { getByText } = await wrap(<OfflineBanner isOffline />);

    expect(getByText(/Çevrimdışısın/)).toBeTruthy();
  });

  it('bekleyen değişiklik varsa sayısını söyler', async () => {
    // Yalnız kalıcı kuyruğa BAŞARIYLA yazılmış değişiklikler sayılır.
    const { getByText } = await wrap(<OfflineBanner isOffline pendingCount={3} />);

    expect(getByText(/3 değişiklik cihazında bekliyor/)).toBeTruthy();
  });

  it('bekleyen değişiklik yokken kaydedildi izlenimi vermez', async () => {
    const { queryByText, getByText } = await wrap(<OfflineBanner isOffline pendingCount={0} />);

    expect(queryByText(/bekliyor/)).toBeNull();
    expect(getByText(/Kayıtlı bilgileri görmeye devam edebilirsin/)).toBeTruthy();
  });

  it('ekran okuyucuya kibar bir canlı bölge olarak duyurulur', async () => {
    const { getByRole } = await wrap(<OfflineBanner isOffline />);

    const banner = getByRole('alert');
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
  });
});
