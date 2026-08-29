import * as SecureStore from 'expo-secure-store';

import {
  MAX_ATTEMPTS,
  MAX_ENTRIES,
  clearOutbox,
  enqueue,
  listQueued,
  listSendable,
  listStuck,
  markAttempted,
  markSent,
  queuedCount,
} from '../completion-outbox';

/**
 * Tamamlama kuyruğu testleri.
 *
 * Faz 05 kabul kriteri: "Uçak modunda bir completion kalıcı outbox'a yazılır
 * ve yeniden açılışta kaybolmaz." Aşağıdaki `store`, uygulamayı kapatıp
 * açmayı taklit eder: modül belleği değil, SecureStore içeriği kalıcıdır.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

/** Cihaz diskini taklit eder: testler arasında bilinçli olarak sıfırlanır. */
let disk: Map<string, string>;

const entry = (mutationId: string, overrides: Record<string, unknown> = {}) => ({
  mutationId,
  circleId: 'c-1',
  taskId: 't-1',
  occurrenceId: '2026-08-28T08:00:00+03:00',
  kind: 'done' as const,
  voidsCompletionId: null,
  ...overrides,
});

describe('completion-outbox', () => {
  beforeEach(() => {
    disk = new Map<string, string>();
    getItemAsync.mockImplementation(async (key: string) => disk.get(key) ?? null);
    setItemAsync.mockImplementation(async (key: string, value: string) => {
      disk.set(key, value);
    });
    deleteItemAsync.mockImplementation(async (key: string) => {
      disk.delete(key);
    });
  });

  it('kaydı kuyruğa ekler ve sayıyı bildirir', async () => {
    // Act
    const result = await enqueue(entry('m-1'));

    // Assert
    expect(result).toEqual({ ok: true, queueSize: 1 });
    await expect(queuedCount()).resolves.toBe(1);
  });

  it('kuyruğu bellekte değil kalıcı diskte tutar', async () => {
    // Arrange: çevrimdışıyken bir tamamlama.
    await enqueue(entry('m-1'));

    // Assert: kayıt gerçekten SecureStore'a yazıldı. Modül hiçbir durum
    // tutmaz; her okuma diskten yapılır, bu yüzden uygulama kapanıp açılınca
    // kuyruk yerinde durur.
    expect(disk.size).toBeGreaterThan(0);
    const written = [...disk.entries()]
      .filter(([key]) => !key.endsWith('__chunks'))
      .map(([, value]) => value)
      .join('');
    expect(written).toContain('m-1');

    // Act: her okuma diski yeniden okur.
    getItemAsync.mockClear();
    await listQueued();

    // Assert
    expect(getItemAsync).toHaveBeenCalled();
  });

  it('uygulama yeniden açıldığında diskteki kuyruğu okur', async () => {
    // Arrange: önceki oturumda yazılmış bir kuyruk; modül belleği boş.
    const previousSession = JSON.stringify([
      {
        ...entry('m-onceki'),
        queuedAt: '2026-08-28T05:00:00.000Z',
        attempts: 0,
      },
    ]);
    disk.set('cairn.completion-outbox_0', previousSession);
    disk.set('cairn.completion-outbox__chunks', '1');

    // Act
    const queued = await listQueued();

    // Assert: uçak modunda yazılan tamamlama yeniden açılışta kaybolmadı.
    expect(queued).toHaveLength(1);
    expect(queued[0]?.mutationId).toBe('m-onceki');
  });

  it('disk yazması başarısızsa kaydedildi demez', async () => {
    // Arrange: depo dolu veya erişilemez.
    setItemAsync.mockRejectedValue(new Error('secure store unavailable'));

    // Act
    const result = await enqueue(entry('m-1'));

    // Assert: olmayan bir güvence verilmez.
    expect(result).toEqual({ ok: false, reason: 'write_failed' });
  });

  it('aynı mutasyon kimliğini iki kez kuyruğa koymaz', async () => {
    // Çift dokunma bir kaydı iki kez sıraya sokmamalıdır.
    await enqueue(entry('m-1'));
    await enqueue(entry('m-1'));

    await expect(queuedCount()).resolves.toBe(1);
  });

  it('kayıtları giriş sırasıyla korur', async () => {
    await enqueue(entry('m-1'));
    await enqueue(entry('m-2'));
    await enqueue(entry('m-3'));

    const queued = await listQueued();

    expect(queued.map((item) => item.mutationId)).toEqual(['m-1', 'm-2', 'm-3']);
  });

  it('kuyruk dolduğunda yeni kaydı reddeder ve eskisini atmaz', async () => {
    // Arrange
    for (let index = 0; index < MAX_ENTRIES; index += 1) {
      await enqueue(entry(`m-${index}`));
    }

    // Act
    const result = await enqueue(entry('taşan'));

    // Assert: kullanıcının işini sessizce düşürmek yerine açıkça reddedilir.
    expect(result).toEqual({ ok: false, reason: 'queue_full' });
    await expect(queuedCount()).resolves.toBe(MAX_ENTRIES);
    const queued = await listQueued();
    expect(queued[0]?.mutationId).toBe('m-0');
  });

  it('gönderilen kaydı kuyruktan siler', async () => {
    await enqueue(entry('m-1'));
    await enqueue(entry('m-2'));

    await markSent('m-1');

    const queued = await listQueued();
    expect(queued.map((item) => item.mutationId)).toEqual(['m-2']);
  });

  it('kuyruk boşalınca depoyu tamamen temizler', async () => {
    await enqueue(entry('m-1'));

    await markSent('m-1');

    expect(disk.size).toBe(0);
  });

  it('başarısız denemeyi sayar ve kaydı kuyrukta bırakır', async () => {
    await enqueue(entry('m-1'));

    await markAttempted('m-1');
    await markAttempted('m-1');

    const queued = await listQueued();
    expect(queued[0]?.attempts).toBe(2);
  });

  it('deneme sınırını aşan kaydı göndermez ama silmez de', async () => {
    // Arrange
    await enqueue(entry('m-1'));
    for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
      await markAttempted('m-1');
    }

    // Assert: sonsuza dek denemek pili tüketir, atmak işi kaybetmektir.
    await expect(listSendable()).resolves.toHaveLength(0);
    await expect(listStuck()).resolves.toHaveLength(1);
    await expect(queuedCount()).resolves.toBe(1);
  });

  it('geri alma kaydını void olarak kuyruğa alır', async () => {
    // Geri alma mevcut tamamlamayı silmez; void kaydı üretir.
    await enqueue(entry('m-void', { kind: 'void', voidsCompletionId: 'completion-1' }));

    const queued = await listQueued();
    expect(queued[0]).toMatchObject({ kind: 'void', voidsCompletionId: 'completion-1' });
  });

  it('oturum kapatmada kuyruğu tamamen siler', async () => {
    // Bir sonraki kullanıcının cihazında öncekinin kayıtları kalmamalıdır.
    await enqueue(entry('m-1'));
    await enqueue(entry('m-2'));

    await clearOutbox();

    await expect(queuedCount()).resolves.toBe(0);
    expect(disk.size).toBe(0);
  });

  it('bozuk depo içeriğini boş kuyruk sayar', async () => {
    // Arrange: dışarıdan bozulmuş kayıt.
    disk.set('cairn.completion-outbox__chunks', '1');
    disk.set('cairn.completion-outbox_0', 'JSON değil');

    // Act & Assert: uygulama çökmez.
    await expect(listQueued()).resolves.toEqual([]);
  });

  it('parçalardan biri eksikse yarım kuyruk döndürmez', async () => {
    // Arrange: uzun bir kuyruk yazılır, sonra bir parçası kaybolur.
    for (let index = 0; index < 20; index += 1) {
      await enqueue(entry(`m-${index}`));
    }
    expect(Number(disk.get('cairn.completion-outbox__chunks'))).toBeGreaterThan(1);
    disk.delete('cairn.completion-outbox_1');

    // Act & Assert: eksik kayıtları gönderilmiş sanmaktansa boş sayılır.
    await expect(listQueued()).resolves.toEqual([]);
  });
});
