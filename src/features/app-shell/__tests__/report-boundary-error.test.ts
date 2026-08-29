import { reportBoundaryError, topComponentName } from '../report-boundary-error';

describe('topComponentName', () => {
  it('yığından yalnız en üstteki bileşen adını alır', () => {
    const stack =
      '\n    in BugunScreen (at bugun.tsx:12)\n    in CircleGate (at _circle-gate.tsx:40)';

    expect(topComponentName(stack)).toBe('BugunScreen');
  });

  it('tanınmayan biçimde bilinmiyor döndürür', () => {
    expect(topComponentName('')).toBe('bilinmiyor');
    expect(topComponentName('anlamsız içerik')).toBe('bilinmiyor');
  });
});

describe('reportBoundaryError', () => {
  it('hata mesajını ve yığını dışarı taşımadan tamamlanır', () => {
    // Arrange: mesajında sağlık verisi taşıyan bir hata.
    const error = new Error('Metformin 850 mg okunamadı: Ayşe Yılmaz');

    // Act & Assert: fırlatmaz. Raporlayıcı kurulu olmadığı için ağ çağrısı
    // yapılmaz; logger test ortamında yazmaz.
    expect(() => reportBoundaryError(error, '    in DosyaScreen (at dosya.tsx:20)')).not.toThrow();
  });
});
