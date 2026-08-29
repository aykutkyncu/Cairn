import { Text as RNText } from 'react-native';
import { render } from '@testing-library/react-native';

import { ErrorBoundary } from '../error-boundary';
import { ThemeProvider } from '../theme-provider';

/**
 * Hata sınırı testleri.
 *
 * Faz 04 kabul kriteri: "Kasıtlı hata Error Boundary tarafından kullanıcı
 * dostu biçimde yakalanır." Ayrıca sözleşme gereği hata METNİ ve sağlık
 * verisi ekrana çıkmamalıdır; bu da burada sabitlenir.
 */

/** Kasıtlı olarak patlayan bileşen. Hata mesajına sağlık verisi konur. */
function ExplodingScreen(): never {
  throw new Error('Metformin 850 mg kaydı okunamadı: hasta Ayşe Yılmaz');
}

const renderInBoundary = async (onError?: (error: Error, stack: string) => void) =>
  render(
    <ThemeProvider initialPreference="light">
      <ErrorBoundary {...(onError === undefined ? {} : { onError })}>
        <ExplodingScreen />
      </ErrorBoundary>
    </ThemeProvider>,
  );

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // React, yakalanan hatayı ayrıca konsola yazar. Test çıktısını
    // kirletmemesi için susturulur; davranış değişmez.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('hata olmadığında çocuklarını gösterir', async () => {
    // Arrange & Act
    const { getByText } = await render(
      <ThemeProvider initialPreference="light">
        <ErrorBoundary>
          <RNText>Sağlam içerik</RNText>
        </ErrorBoundary>
      </ThemeProvider>,
    );

    // Assert
    expect(getByText('Sağlam içerik')).toBeTruthy();
  });

  it('kasıtlı hatayı yakalar ve kullanıcı dostu ekran gösterir', async () => {
    // Act
    const { getByText } = await renderInBoundary();

    // Assert
    expect(getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(getByText('Tekrar dene')).toBeTruthy();
  });

  it('hata metnini ve sağlık verisini ekrana yazmaz', async () => {
    // Act
    const { queryByText, toJSON } = await renderInBoundary();
    const rendered = JSON.stringify(toJSON());

    // Assert
    expect(queryByText(/Metformin/)).toBeNull();
    expect(rendered).not.toContain('Metformin');
    expect(rendered).not.toContain('Ayşe');
    expect(rendered).not.toContain('850 mg');
  });

  it('raporlama kancasını ham hatayla çağırır', async () => {
    // Arrange
    const onError = jest.fn();

    // Act
    await renderInBoundary(onError);

    // Assert: temizlik raporlama katmanının işidir; sınır ham hatayı verir.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('ana ekrana dönüş verilmediğinde o düğmeyi göstermez', async () => {
    // Act
    const { queryByText } = await renderInBoundary();

    // Assert
    expect(queryByText('Ana ekrana dön')).toBeNull();
  });
});
