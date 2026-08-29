import {
  containsDroppedKey,
  maskDirectIdentifiers,
  scrubContext,
  scrubEvent,
  shouldKeepBreadcrumb,
} from '../error-reporting';

/**
 * Hata raporu temizliği testleri.
 *
 * Bu testler Faz 04'ün "örnek olay hasta adı, ilaç, not veya request body
 * içermez" kriterinin kanıtıdır. Gerçek bir raporlayıcı kurulu olmadığı için
 * kanıt, gönderilecek yükü üreten saf fonksiyonlar üzerindedir.
 */

describe('scrubContext', () => {
  it('izin listesinde olmayan alanları düşürür', () => {
    // Arrange: sağlık verisi taşıyan gerçekçi bir bağlam.
    const context = {
      event: 'task_completed',
      patientName: 'Ayşe Yılmaz',
      medication: 'Metformin 850 mg',
      note: 'Sabah şekeri 180 ölçüldü',
      diagnosis: 'Tip 2 diyabet',
    };

    // Act
    const safe = scrubContext(context);

    // Assert
    expect(safe).toEqual({ event: 'task_completed' });
    expect(JSON.stringify(safe)).not.toContain('Ayşe');
    expect(JSON.stringify(safe)).not.toContain('Metformin');
    expect(JSON.stringify(safe)).not.toContain('180');
  });

  it('izin listesindeki bir alan nesne taşıyorsa onu da düşürür', () => {
    // Arrange: izinli anahtar altında gizlenmiş yük.
    const context = { operation: { name: 'list_tasks', body: { note: 'gizli' } } };

    // Act
    const safe = scrubContext(context);

    // Assert
    expect(safe).toEqual({});
  });

  it('çok uzun dizgeleri kırpar', () => {
    // Arrange
    const context = { operation: 'x'.repeat(500) };

    // Act
    const safe = scrubContext(context);

    // Assert
    expect(String(safe.operation).length).toBeLessThanOrEqual(201);
  });

  it('prototip kirlenmesine yol açan anahtarları taşımaz', () => {
    // Arrange
    const context = JSON.parse('{"__proto__": {"polluted": true}, "event": "x"}') as Record<
      string,
      unknown
    >;

    // Act
    const safe = scrubContext(context);

    // Assert
    expect(safe).toEqual({ event: 'x' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('maskDirectIdentifiers', () => {
  it('e-posta adresini maskeler', () => {
    expect(maskDirectIdentifiers('kullanıcı ali@example.com ile giriş yaptı')).toBe(
      'kullanıcı [e-posta] ile giriş yaptı',
    );
  });

  it('telefon numarasını maskeler', () => {
    expect(maskDirectIdentifiers('ara: +90 532 123 45 67')).toBe('ara: [telefon]');
  });
});

describe('scrubEvent', () => {
  it('istek gövdesini, kullanıcıyı ve extra alanlarını taşımaz', () => {
    // Arrange: bir raporlayıcının tipik ham olayı.
    const rawEvent = {
      message: 'Request failed for ayse@example.com',
      level: 'error',
      tags: { event: 'sync_failed', operation: 'push_outbox', patientName: 'Ayşe' },
      request: { url: 'https://x/tasks?patient=Ayşe', data: { note: 'kan şekeri 180' } },
      user: { email: 'ayse@example.com', id: 'u-1' },
      extra: { medication: 'Metformin' },
    };

    // Act
    const scrubbed = scrubEvent(rawEvent);
    const serialized = JSON.stringify(scrubbed);

    // Assert
    expect(scrubbed.tags).toEqual({ event: 'sync_failed', operation: 'push_outbox' });
    expect(scrubbed.message).toBe('Request failed for [e-posta]');
    expect(containsDroppedKey(scrubbed as unknown as Record<string, unknown>)).toBe(false);
    for (const leak of ['Ayşe', 'ayse@example.com', 'Metformin', '180', 'tasks?patient']) {
      expect(serialized).not.toContain(leak);
    }
  });

  it('mesajı olmayan olayda bile hassas alan üretmez', () => {
    const scrubbed = scrubEvent({ tags: { note: 'gizli' } });

    expect(scrubbed.message).toBe('unknown_error');
    expect(scrubbed.tags).toEqual({});
  });
});

describe('shouldKeepBreadcrumb', () => {
  it('ağ ve konsol breadcrumb’larını düşürür', () => {
    expect(shouldKeepBreadcrumb('xhr')).toBe(false);
    expect(shouldKeepBreadcrumb('fetch')).toBe(false);
    expect(shouldKeepBreadcrumb('console')).toBe(false);
  });

  it('gezinme breadcrumb’ını tutar', () => {
    expect(shouldKeepBreadcrumb('navigation')).toBe(true);
  });
});
