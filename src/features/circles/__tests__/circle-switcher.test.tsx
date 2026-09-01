import { render, userEvent } from '@testing-library/react-native';

import { resetAuthStore, useAuthStore } from '@/features/auth';
import { ThemeProvider } from '@/ui';

import { CircleSwitcher } from '../circle-switcher';

/**
 * Çember değiştirici testleri.
 *
 * Kritik davranış: kullanıcı hangi kişinin bakımına baktığını her an
 * görebilmelidir. Yanlış çemberde işaretlenen bir ilaç, yanlış kişiye
 * verilmiş sayılır.
 */

const mockUseActiveCircle = jest.fn();

jest.mock('../use-circles', () => ({
  useActiveCircle: () => mockUseActiveCircle(),
}));

const circle = (
  id: string,
  name: string,
  role: 'owner' | 'caregiver' | 'viewer' = 'caregiver',
) => ({
  id,
  careRecipientName: name,
  timezone: 'Europe/Istanbul',
  defaultCurrency: 'TRY',
  role,
});

const renderSwitcher = () =>
  render(
    <ThemeProvider initialPreference="light">
      <CircleSwitcher />
    </ThemeProvider>,
  );

describe('CircleSwitcher', () => {
  beforeEach(() => {
    mockUseActiveCircle.mockReset();
    resetAuthStore();
  });

  it('yüklenirken sakin bir bekleme metni gösterir', async () => {
    // Arrange
    mockUseActiveCircle.mockReturnValue({
      activeCircle: null,
      circles: [],
      isLoading: true,
      isError: false,
    });

    // Act
    const { getByText } = await renderSwitcher();

    // Assert
    expect(getByText('Yükleniyor')).toBeTruthy();
  });

  it('çember yokken bunu açıkça söyler', async () => {
    // Arrange
    mockUseActiveCircle.mockReturnValue({
      activeCircle: null,
      circles: [],
      isLoading: false,
      isError: false,
    });

    // Act
    const { getByText, queryByText } = await renderSwitcher();

    // Assert
    // Kurulum yapılmadan "çember" gibi bir iç terim gösterilmez.
    expect(getByText('Cairn')).toBeTruthy();
    expect(queryByText(/Çember/)).toBeNull();
  });

  it('tek çemberde seçici açmaz', async () => {
    // Arrange: tek seçenek varken seçici sunmak, boş bir listeyle karşılamaktır.
    const only = circle('c-1', 'Fatma Demir', 'owner');
    mockUseActiveCircle.mockReturnValue({
      activeCircle: only,
      circles: [only],
      isLoading: false,
      isError: false,
    });

    // Act
    const { getByText, queryByRole } = await renderSwitcher();

    // Assert
    expect(getByText('Fatma Demir')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('aktif çemberi ve rolü erişilebilir adda birlikte duyurur', async () => {
    // Arrange
    const first = circle('c-1', 'Fatma Demir', 'owner');
    mockUseActiveCircle.mockReturnValue({
      activeCircle: first,
      circles: [first, circle('c-2', 'Hasan Yıldız')],
      isLoading: false,
      isError: false,
    });

    // Act
    const { getByRole } = await renderSwitcher();

    // Assert
    expect(getByRole('button', { name: 'Aktif çember: Fatma Demir. Rolün: Sorumlu' })).toBeTruthy();
  });

  it('başka çember seçildiğinde aktif çemberi değiştirir', async () => {
    // Arrange
    const first = circle('c-1', 'Fatma Demir');
    const second = circle('c-2', 'Hasan Yıldız');
    mockUseActiveCircle.mockReturnValue({
      activeCircle: first,
      circles: [first, second],
      isLoading: false,
      isError: false,
    });

    // Act
    const user = userEvent.setup();
    const { getByRole } = await renderSwitcher();
    await user.press(
      getByRole('button', { name: 'Aktif çember: Fatma Demir. Rolün: Bakım veren' }),
    );
    await user.press(getByRole('button', { name: 'Hasan Yıldız. Bakım veren' }));

    // Assert
    expect(useAuthStore.getState().activeCircleId).toBe('c-2');
  });
});
