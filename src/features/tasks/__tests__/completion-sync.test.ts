import * as SecureStore from 'expo-secure-store';

import { MAX_ATTEMPTS, enqueue, listQueued, markAttempted } from '../completion-outbox';
import { flushCompletionOutbox, pendingKeysOf } from '../completion-sync';

/**
 * Kuyruk gönderimi testleri.
 *
 * Faz 05 kabul kriteri: "Eşzamanlı tamamlama tek kabul edilmiş completion
 * üretir." Sunucu tekil kısıtı ihlal ettiğinde istemci bunu HATA değil,
 * "zaten kaydedilmiş" olarak ele almalı ve kaydı kuyruktan düşürmelidir.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockSubmit = jest.fn();

jest.mock('../task-repository', () => ({
  submitCompletion: (input: unknown) => mockSubmit(input),
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

describe('flushCompletionOutbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disk = new Map<string, string>();
    getItemAsync.mockImplementation(async (key: string) => disk.get(key) ?? null);
    setItemAsync.mockImplementation(async (key: string, value: string) => {
      disk.set(key, value);
    });
    deleteItemAsync.mockImplementation(async (key: string) => {
      disk.delete(key);
    });
    mockSubmit.mockResolvedValue({ status: 'accepted' });
  });

  it('boş kuyrukta sunucuya hiç gitmez', async () => {
    const result = await flushCompletionOutbox();

    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('kabul edilen kaydı kuyruktan siler', async () => {
    await enqueue(entry('m-1'));

    const result = await flushCompletionOutbox();

    expect(result).toMatchObject({ sent: 1, remaining: 0 });
    await expect(listQueued()).resolves.toEqual([]);
  });

  it('kaydı kuyruktakiyle aynı mutasyon kimliğiyle gönderir', async () => {
    // İdempotanslığın temeli: yeniden deneme aynı kimlikle yapılır.
    await enqueue(entry('m-1'));

    await flushCompletionOutbox();

    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ mutationId: 'm-1' }));
  });

  it('zaten kaydedilmiş yanıtını başarı sayar ve kuyruktan düşürür', async () => {
    // Eşzamanlı tamamlama: başkası aynı örneği tamamlamış olabilir.
    // Tekrar denemek yeni bir sonuç üretmez.
    mockSubmit.mockResolvedValue({ status: 'already_recorded' });
    await enqueue(entry('m-1'));

    const result = await flushCompletionOutbox();

    expect(result).toMatchObject({ sent: 1, remaining: 0 });
    await expect(listQueued()).resolves.toEqual([]);
  });

  it('geçici hatada kaydı kuyrukta bırakır ve denemeyi sayar', async () => {
    mockSubmit.mockResolvedValue({ status: 'retry' });
    await enqueue(entry('m-1'));

    const result = await flushCompletionOutbox();

    expect(result).toMatchObject({ sent: 0, failed: 1, remaining: 1 });
    const queued = await listQueued();
    expect(queued[0]?.attempts).toBe(1);
  });

  it('kayıtları sırayla gönderir', async () => {
    // Bir tamamlama ile onun geri alınması ters sırada ulaşmamalıdır.
    await enqueue(entry('m-1'));
    await enqueue(entry('m-2', { kind: 'void', voidsCompletionId: 'comp-1' }));

    await flushCompletionOutbox();

    expect(mockSubmit.mock.calls.map((call) => call[0].mutationId)).toEqual(['m-1', 'm-2']);
  });

  it('ilk kalıcı hatada durur ve kalanları boşuna denemez', async () => {
    // Ağ yoksa kalan kayıtları denemek yalnız sayaçları şişirir.
    mockSubmit.mockResolvedValue({ status: 'retry' });
    await enqueue(entry('m-1'));
    await enqueue(entry('m-2'));

    await flushCompletionOutbox();

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const queued = await listQueued();
    expect(queued[1]?.attempts).toBe(0);
  });

  it('deneme sınırını aşan kaydı hiç göndermez', async () => {
    await enqueue(entry('m-1'));
    for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
      await markAttempted('m-1');
    }

    const result = await flushCompletionOutbox();

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
    // Kayıt silinmez: kullanıcının işi kaybolmaz.
    await expect(listQueued()).resolves.toHaveLength(1);
  });

  it('bağlantı geri geldiğinde bekleyen kayıt gönderilir', async () => {
    // Arrange: uçak modunda tamamlama, gönderim başarısız.
    mockSubmit.mockResolvedValue({ status: 'retry' });
    await enqueue(entry('m-1'));
    await flushCompletionOutbox();
    await expect(listQueued()).resolves.toHaveLength(1);

    // Act: bağlantı geri geldi.
    mockSubmit.mockResolvedValue({ status: 'accepted' });
    const result = await flushCompletionOutbox();

    // Assert
    expect(result).toMatchObject({ sent: 1, remaining: 0 });
    await expect(listQueued()).resolves.toEqual([]);
  });
});

describe('pendingKeysOf', () => {
  it('kuyruk kayıtlarını gün planının anahtar biçimine çevirir', () => {
    const keys = pendingKeysOf([
      { ...entry('m-1'), queuedAt: '2026-08-28T05:00:00.000Z', attempts: 0 },
    ]);

    expect(keys.has('t-1|2026-08-28T08:00:00+03:00')).toBe(true);
  });

  it('boş kuyrukta boş küme döndürür', () => {
    expect(pendingKeysOf([]).size).toBe(0);
  });
});
