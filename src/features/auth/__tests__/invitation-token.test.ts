import * as Crypto from 'expo-crypto';

import {
  TOKEN_HASH_BYTE_LENGTH,
  generateInvitationToken,
  hashInvitationToken,
  isValidTokenHash,
  isWellFormedInvitationToken,
  tokenHashToBytes,
} from '../invitation-token';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
}));

const getRandomBytesAsync = Crypto.getRandomBytesAsync as jest.MockedFunction<
  typeof Crypto.getRandomBytesAsync
>;
const digestStringAsync = Crypto.digestStringAsync as jest.MockedFunction<
  typeof Crypto.digestStringAsync
>;

describe('generateInvitationToken', () => {
  it('işletim sisteminin CSPRNG’sinden 32 bayt ister', async () => {
    // Arrange
    getRandomBytesAsync.mockResolvedValue(new Uint8Array(32).fill(7));

    // Act
    await generateInvitationToken();

    // Assert: Math.random değil, expo-crypto kullanılır.
    expect(getRandomBytesAsync).toHaveBeenCalledWith(32);
  });

  it('32 karakterlik, biçimsel olarak geçerli bir token üretir', async () => {
    // Arrange
    getRandomBytesAsync.mockResolvedValue(
      Uint8Array.from({ length: 32 }, (_value, index) => index * 7),
    );

    // Act
    const token = await generateInvitationToken();

    // Assert
    expect(token).toHaveLength(32);
    expect(isWellFormedInvitationToken(token)).toBe(true);
  });

  it('karışması kolay karakterleri (l, o, 0, 1) içermez', async () => {
    // Arrange: paylaşım bağlantısı elle de yazılabilmelidir.
    getRandomBytesAsync.mockResolvedValue(
      Uint8Array.from({ length: 32 }, (_value, index) => index),
    );

    // Act
    const token = await generateInvitationToken();

    // Assert
    expect(token).not.toMatch(/[lo01]/);
  });
});

describe('hashInvitationToken', () => {
  it('SHA-256 kullanır ve bytea biçiminde döndürür', async () => {
    // Arrange
    const hex = 'a'.repeat(TOKEN_HASH_BYTE_LENGTH * 2);
    digestStringAsync.mockResolvedValue(hex);

    // Act
    const hash = await hashInvitationToken('token');

    // Assert
    expect(digestStringAsync).toHaveBeenCalledWith('SHA-256', 'token', { encoding: 'hex' });
    expect(hash).toBe(`\\x${hex}`);
  });

  it('üretilen hash sunucunun beklediği uzunlukta', async () => {
    // Arrange
    digestStringAsync.mockResolvedValue('b'.repeat(64));

    // Act
    const hash = await hashInvitationToken('token');

    // Assert
    expect(isValidTokenHash(hash)).toBe(true);
    expect(tokenHashToBytes(hash)).toHaveLength(TOKEN_HASH_BYTE_LENGTH);
  });
});

describe('isValidTokenHash', () => {
  it('doğru uzunlukta bytea hash’ini kabul eder', () => {
    expect(isValidTokenHash(`\\x${'0'.repeat(64)}`)).toBe(true);
  });

  it('kısa hash’i reddeder', () => {
    expect(isValidTokenHash(`\\x${'0'.repeat(32)}`)).toBe(false);
  });

  it('bytea öneki olmayan değeri reddeder', () => {
    expect(isValidTokenHash('0'.repeat(64))).toBe(false);
  });

  it('onaltılık olmayan karakter içeren değeri reddeder', () => {
    expect(isValidTokenHash(`\\x${'z'.repeat(64)}`)).toBe(false);
  });
});

describe('isWellFormedInvitationToken', () => {
  it('yanlış uzunluktaki tokenı reddeder', () => {
    expect(isWellFormedInvitationToken('abc')).toBe(false);
  });

  it('alfabe dışı karakter içeren tokenı reddeder', () => {
    expect(isWellFormedInvitationToken(`${'a'.repeat(31)}!`)).toBe(false);
  });
});
