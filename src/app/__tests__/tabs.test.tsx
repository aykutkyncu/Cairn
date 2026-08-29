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
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

// Bugün ekranı Faz 05'te gerçek veriye bağlandı; burada sınanan yalnız
// çember kapısının dört durumu olduğu için hook taklit edilir. Ekranın
// kendi davranışı `features/tasks/__tests__/day-plan-view.test.tsx`
// içinde sınanır.
const mockUseDayPlan = jest.fn();

jest.mock('@/features/tasks', () => {
  const actual = jest.requireActual('@/features/tasks');
  return { ...actual, useDayPlan: () => mockUseDayPlan() };
});

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

/**
 * Çember kapısının dört durumu her sekmede aynıdır. Bugün ekranı kendi
 * başlığını gün planı görünümünden alır, bu yüzden başlık testlerinde
 * ayrı ele alınır.
 */
const screens = [
  ['Takvim', TakvimScreen],
  ['Dosya', DosyaScreen],
  ['Daha fazlası', DahaFazlasiScreen],
] as const;

const allScreens = [...screens, ['Bugün', BugunScreen]] as const;

const renderScreen = (Screen: () => React.JSX.Element) =>
  render(
    <ThemeProvider initialPreference="light">
      <Screen />
    </ThemeProvider>,
  );

const emptyDayPlan = {
  plan: { localDate: '2026-08-28', blocks: [], overdue: [], total: 0, completed: 0 },
  isLoading: false,
  isError: false,
  isOnline: true,
  pendingCount: 0,
  complete: jest.fn(),
  undo: jest.fn(),
  refetch: jest.fn(),
};

describe('sekme ekranları', () => {
  beforeEach(() => {
    mockUseActiveCircle.mockReset();
    mockUseDayPlan.mockReset();
    mockUseDayPlan.mockReturnValue(emptyDayPlan);
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

  it.each(allScreens)('%s çember yokken kurma çağrısı gösterir', async (_title, Screen) => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(empty);

    // Act
    const { getByText } = await renderScreen(Screen);

    // Assert
    expect(getByText('Henüz bir çemberin yok')).toBeTruthy();
  });

  it.each(allScreens)('%s hata durumunda teknik ayrıntı göstermez', async (_title, Screen) => {
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

    const { toJSON } = await renderScreen(TakvimScreen);

    expect(JSON.stringify(toJSON())).not.toContain('Fatma Demir');
  });

  it('Bugün ekranı gün planını gösterir', async () => {
    // Arrange
    mockUseActiveCircle.mockReturnValue(loaded);

    // Act
    const { getByRole, getByText } = await renderScreen(BugunScreen);

    // Assert
    expect(getByRole('header', { name: 'Bugün' })).toBeTruthy();
    expect(getByText('Bugün için planlanmış bir şey yok.')).toBeTruthy();
  });

  it('Bugün ekranı gün planı yüklenirken iskelet gösterir', async () => {
    mockUseActiveCircle.mockReturnValue(loaded);
    mockUseDayPlan.mockReturnValue({ ...emptyDayPlan, isLoading: true });

    const { getByLabelText } = await renderScreen(BugunScreen);

    expect(getByLabelText('Bugünün planı yükleniyor')).toBeTruthy();
  });

  it('Bugün ekranı çevrimdışıyken bekleyen sayısını gösterir', async () => {
    mockUseActiveCircle.mockReturnValue(loaded);
    mockUseDayPlan.mockReturnValue({ ...emptyDayPlan, isOnline: false, pendingCount: 2 });

    const { getByText } = await renderScreen(BugunScreen);

    expect(getByText(/2 değişiklik cihazında bekliyor/)).toBeTruthy();
  });
});
