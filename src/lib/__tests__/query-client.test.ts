import { clearQueryCache, createQueryClient, shouldRetry } from '../query-client';

describe('shouldRetry', () => {
  it('yetki hatalarını yeniden denemez', () => {
    expect(shouldRetry(0, { code: 'forbidden' })).toBe(false);
    expect(shouldRetry(0, { code: 'unauthenticated' })).toBe(false);
  });

  it('tüketilmiş daveti yeniden denemez', () => {
    expect(shouldRetry(0, { code: 'invitation_already_used' })).toBe(false);
  });

  it('ağ hatasını sınırlı sayıda yeniden dener', () => {
    expect(shouldRetry(0, { code: 'network' })).toBe(true);
    expect(shouldRetry(1, { code: 'network' })).toBe(true);
    expect(shouldRetry(2, { code: 'network' })).toBe(false);
  });

  it('kodu olmayan hatayı da sınırlı sayıda dener', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(true);
    expect(shouldRetry(5, new Error('boom'))).toBe(false);
  });
});

describe('clearQueryCache', () => {
  it('önbellekteki tüm veriyi siler', async () => {
    // Arrange
    const client = createQueryClient();
    client.setQueryData(['circles', 'list'], [{ id: 'c-1' }]);
    expect(client.getQueryData(['circles', 'list'])).toBeDefined();

    // Act
    await clearQueryCache(client);

    // Assert: çıkış sonrası bir sonraki kullanıcı öncekinin verisini görmez.
    expect(client.getQueryData(['circles', 'list'])).toBeUndefined();
  });
});
