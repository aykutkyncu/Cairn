import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import BugunScreen from '../(tabs)/bugun';
import DahaFazlasiScreen from '../(tabs)/daha-fazlasi';
import DosyaScreen from '../(tabs)/dosya';
import TakvimScreen from '../(tabs)/takvim';

/**
 * Sekme ekranı testleri.
 *
 * Sözleşme: her ekran loading, empty ve error durumunu AÇIKÇA ele alır.
 * Burada sınanan, ekranların bu durumları çember kapısı üzerinden gerçekten
 * gösterdiğidir — henüz veri olmadığı için içerik değil, durum davranışı.
 */

const mockUseActiveCircle = jest.fn();

jest.mock('@/features/circles', () => ({
  useActiveCircle: () => mockUseActiveCircle(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const circle = {
  id: 'c-1',
  careRecipientName: 'Fatma Demir',
  timezone: 'Europe/Istanbul',
  defaultCurrency: 'TRY',
  role: 'caregiver' as const,
};

const loaded = { activeCircle: circle, circles: [circle], isLoading: false, isError: false };
const loading = { activeCircle: null, circles: [], isLoading: true, isError: false };
const empty = { activeCircle: null, circles: [], isLoading: false, isError: false };
const failed = { activeCircle: null, circles: [], isLoading: false, isError: true };

const screens = [
  ['Bugün', BugunScreen],
  ['Takvim', TakvimScreen],
  ['Dosya', DosyaScreen],
  ['Daha fazlası', DahaFazlasiScreen],
] as const;

const renderScreen = (Screen: () => React.JSX.Element) =>
  render(
    <ThemeProvider initialPreference="light">
      <Screen />
    </ThemeProvider>,
  );

describe('sekme ekranları', () => {
  beforeEach(() => {
    mockUseActiveCircle.mockReset();
  });

  it.each(screens)('%s başlığını erişilebilir başlık olarak gösterir', async (title, Screen) => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(loaded);

    // Act
    const { getByRole } = await renderScreen(Screen);

    // Assert
    expect(getByRole('header', { name: title })).toBeTruthy();
  });

  it.each(screens)('%s yüklenirken başlık yerine iskelet gösterir', async (title, Screen) => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(loading);

    // Act
    const { queryByRole, getByLabelText } = await renderScreen(Screen);

    // Assert
    expect(queryByRole('header', { name: title })).toBeNull();
    expect(getByLabelText('İçerik yükleniyor')).toBeTruthy();
  });

  it.each(screens)('%s çember yokken kurma çağrısı gösterir', async (_title, Screen) => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(empty);

    // Act
    const { getByText } = await renderScreen(Screen);

    // Assert
    expect(getByText('Henüz bir çemberin yok')).toBeTruthy();
  });

  it.each(screens)('%s hata durumunda teknik ayrıntı göstermez', async (_title, Screen) => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(failed);

    // Act
    const { getByText, toJSON } = await renderScreen(Screen);

    // Assert
    expect(getByText('Çemberler alınamadı')).toBeTruthy();
    const rendered = JSON.stringify(toJSON());
    expect(rendered).not.toContain('42501');
    expect(rendered).not.toContain('unauthenticated');
  });

  it('bakılan kişinin adını sekme içeriğine yazmaz', async () => {
    // Sözleşme: bakılan kişinin adı özel nitelikli veriye işaret eder ve
    // yalnız çember değiştiricide, kullanıcının bakışında bulunur.
    mockUseActiveCircle.mockReturnValue(loaded);

    const { toJSON } = await renderScreen(BugunScreen);

    expect(JSON.stringify(toJSON())).not.toContain('Fatma Demir');
  });
});
