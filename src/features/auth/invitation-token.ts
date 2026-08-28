import * as Crypto from 'expo-crypto';

/**
 * Davet tokenı üretimi ve hash'lenmesi.
 *
 * KARAR: ham token İSTEMCİDE üretilir, sunucuya yalnız SHA-256 hash'i gider.
 * Böylece düz token sunucu loglarına, hata raporlarına veya veritabanına
 * hiçbir aşamada düşmez. Bağlantıyı yalnız daveti oluşturan cihaz bilir ve
 * cihazın kendi paylaşım sayfasıyla iletir.
 *
 * Kabul tarafında da aynı işlem yapılır: bağlantıdaki tokenın hash'i hesaplanıp
 * sunucuya gönderilir. Sunucu ham tokenı hiç görmez.
 */

/** 32 bayt = 256 bit entropi. */
const TOKEN_BYTE_LENGTH = 32;

/** Sunucunun beklediği hash uzunluğu (SHA-256). */
export const TOKEN_HASH_BYTE_LENGTH = 32;

/** URL'de güvenle taşınabilen, karışması kolay karakterleri içermeyen alfabe. */
const BASE32_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Bayt dizisini URL güvenli metne çevirir. */
const encodeToken = (bytes: Uint8Array): string => {
  let out = '';
  for (const byte of bytes) {
    // Her bayttan 5 bit alınır; sonuç 32 karakterlik alfabeye eşlenir.
    out += BASE32_ALPHABET.charAt(byte % BASE32_ALPHABET.length);
  }
  return out;
};

/**
 * Kriptografik olarak rastgele bir davet tokenı üretir.
 *
 * expo-crypto işletim sisteminin CSPRNG'sini kullanır; Math.random KULLANILMAZ.
 */
export const generateInvitationToken = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(TOKEN_BYTE_LENGTH);
  return encodeToken(bytes);
};

/** Onaltılık metni bayt dizisine çevirir. */
const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from({ length: hex.length / 2 }, (_value, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );

/**
 * Tokenın SHA-256 hash'ini Postgres `bytea` biçiminde döndürür.
 *
 * PostgREST bytea parametrelerini `\x...` onaltılık biçiminde bekler.
 */
export const hashInvitationToken = async (token: string): Promise<string> => {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return `\\x${hex}`;
};

/** Hash'in beklenen uzunlukta olduğunu doğrular (32 bayt = 64 onaltılık karakter). */
export const isValidTokenHash = (hash: string): boolean => {
  if (!hash.startsWith('\\x')) return false;
  const hex = hash.slice(2);
  return hex.length === TOKEN_HASH_BYTE_LENGTH * 2 && /^[0-9a-f]+$/.test(hex);
};

/** Test ve doğrulama için: hash metnini bayt dizisine çevirir. */
export const tokenHashToBytes = (hash: string): Uint8Array => hexToBytes(hash.slice(2));

/**
 * Bağlantıdan gelen tokenın biçimsel olarak geçerli olup olmadığını denetler.
 *
 * Bu bir yetki kontrolü DEĞİLDİR; yalnız açıkça bozuk girdiyi sunucuya
 * göndermeden eler. Gerçek doğrulama sunucudaki atomik kabul işlemidir.
 */
export const isWellFormedInvitationToken = (token: string): boolean =>
  token.length === TOKEN_BYTE_LENGTH &&
  [...token].every((character) => BASE32_ALPHABET.includes(character));
