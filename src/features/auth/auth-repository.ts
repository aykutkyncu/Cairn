import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClient } from '@/lib/supabase';

import { hashInvitationToken, isValidTokenHash } from './invitation-token';
import { clearSessionArtifacts } from './session-cleanup';

/**
 * Kimlik ve üyelik veri erişimi.
 *
 * Ekranlar Supabase'e doğrudan erişmez; bu katmandan geçer. Sunucudan gelen
 * her değer Zod ile sınırda doğrulanır. Hata raporlarına yalnız işlem adı ve
 * hassas olmayan kod gider; e-posta, ad veya sağlık verisi asla.
 */

/** Uygulama katmanının anlayacağı, teknik ayrıntı içermeyen hata kodları. */
export type AuthErrorCode =
  | 'not_configured'
  | 'rate_limited'
  | 'invitation_invalid'
  | 'invitation_expired'
  | 'invitation_already_used'
  | 'forbidden'
  | 'unauthenticated'
  | 'network'
  | 'unknown';

export type AuthResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly code: AuthErrorCode };

const uuidSchema = z.string().uuid();

/** Supabase RPC hatasını hassas içerik taşımayan bir koda indirger. */
const toErrorCode = (error: unknown): AuthErrorCode => {
  if (typeof error !== 'object' || error === null) return 'unknown';

  const record = error as { readonly hint?: unknown; readonly code?: unknown };
  const hint = typeof record.hint === 'string' ? record.hint : '';
  const code = typeof record.code === 'string' ? record.code : '';

  switch (hint) {
    case 'rate_limited':
      return 'rate_limited';
    case 'invitation_expired':
      return 'invitation_expired';
    case 'invitation_already_used':
      return 'invitation_already_used';
    case 'invitation_invalid':
      return 'invitation_invalid';
    case 'forbidden':
      return 'forbidden';
    case 'unauthenticated':
      return 'unauthenticated';
    default:
      break;
  }

  if (code === '42501') return 'forbidden';
  if (code === '53400') return 'rate_limited';
  return 'unknown';
};

/**
 * Hesapsız başlatır: anonim ama GERÇEK bir oturum açar.
 *
 * Neden: uygulamayı açar açmaz e-posta istemek, değeri hiç görmemiş bir
 * kullanıcıyı kapıda kaybettirir. Anonim hesabın kendi `auth.uid()`'si
 * vardır; RLS, çember kurma ve tüm yazma yolları normal çalışır. Sahte bir
 * "demo modu" DEĞİLDİR — veri gerçektir ve sonradan e-posta bağlanınca
 * aynı veri korunur.
 *
 * **Sınırı açıkça yazılmalıdır:** e-posta bağlanmadan hesap yalnız bu
 * cihazdadır. Cihaz kaybolursa veriyi geri getirecek bir kimlik kanıtı
 * yoktur. Arayüz bunu kullanıcıya söylemek zorundadır.
 *
 * Supabase panelinde "Anonymous sign-ins" kapalıysa sunucu reddeder; bu
 * durumda kullanıcı e-postayla girişe yönlendirilir.
 */
export const startAnonymously = async (): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  try {
    const { data, error } = await getSupabaseClient().auth.signInAnonymously();

    if (error !== null && error !== undefined) {
      logger.warn('anonymous_start_failed', { code: error.status ?? 0 });
      return { ok: false, code: toErrorCode(error) };
    }

    if (data?.session === null || data?.session === undefined) {
      logger.warn('anonymous_start_empty_session');
      return { ok: false, code: 'unknown' };
    }

    logger.info('anonymous_started');
    return { ok: true, data: null };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * Anonim hesaba e-posta bağlar.
 *
 * Hesap değişmez: aynı `auth.uid()`, aynı çemberler, aynı veri. Yalnız
 * kurtarılabilir hale gelir. Supabase doğrulama e-postası gönderir;
 * **e-posta onaylanana kadar hesap anonim sayılmaya devam eder**, çünkü
 * onaylanmamış bir adres kurtarma sağlamaz.
 */
export const linkEmail = async (email: string): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  try {
    const { error } = await getSupabaseClient().auth.updateUser({ email: email.trim() });

    if (error !== null && error !== undefined) {
      logger.warn('link_email_failed', { code: error.status ?? 0 });
      return { ok: false, code: toErrorCode(error) };
    }

    logger.info('link_email_requested');
    return { ok: true, data: null };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * E-posta ile magic-link gönderir.
 *
 * Şifre kullanılmaz. Kullanıcıya "bağlantı gönderildi" mesajı, e-postanın
 * kayıtlı olup olmadığından BAĞIMSIZ gösterilir; aksi halde hangi adreslerin
 * kayıtlı olduğu sızardı.
 */
export const sendMagicLink = async (
  email: string,
  redirectTo: string,
): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  try {
    const { error } = await getSupabaseClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error !== null) {
      logger.warn('magic_link_failed', { code: error.status ?? 0 });
      return { ok: false, code: toErrorCode(error) };
    }

    logger.info('magic_link_sent');
    return { ok: true, data: null };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * E-postaya gönderilen 6 haneli kodu oturuma çevirir.
 *
 * Neden kod: magic-link mobilde en zayıf yerinde çalışır — kullanıcı
 * uygulamadan çıkar, posta uygulamasını açar, bağlantıya dokunur, geri
 * döner. Bakım verenin dikkati zaten bölünmüştür. Kod, uygulamadan hiç
 * çıkmadan girmeyi sağlar; bağlantı yedek olarak durur.
 *
 * Kod hassastır ve tek kullanımlıktır: log'a, hata raporuna veya arayüz
 * hata metnine yazılmaz.
 *
 * **Gereklilik:** Supabase'in "Magic Link" e-posta şablonu `{{ .Token }}`
 * içermelidir. İçermezse kullanıcıya kod ulaşmaz; bu durumda bağlantıyla
 * giriş çalışmaya devam eder.
 */
export const verifyEmailCode = async (email: string, code: string): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  const token = code.trim();
  if (token.length === 0) return { ok: false, code: 'unauthenticated' };

  try {
    const { data, error } = await getSupabaseClient().auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error !== null && error !== undefined) {
      // Yalnız HTTP durumu loglanır; kod ve e-posta yazılmaz.
      logger.warn('email_code_failed', { code: error.status ?? 0 });
      // Yanlış veya süresi dolmuş kod, ağ hatası gibi gösterilmemelidir:
      // kullanıcı "tekrar dene" yerine "yeni kod iste" yapmalıdır.
      return { ok: false, code: error.status === 403 ? 'unauthenticated' : toErrorCode(error) };
    }

    if (data?.session === null || data?.session === undefined) {
      logger.warn('email_code_empty_session');
      return { ok: false, code: 'unauthenticated' };
    }

    logger.info('email_code_verified');
    return { ok: true, data: null };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * Magic-link dönüşündeki PKCE kodunu oturuma çevirir.
 *
 * Yalnız NATIVE için gereklidir. Web'de `detectSessionInUrl` açıktır ve
 * Supabase istemcisi kodu sayfa yüklenirken kendisi takas eder; native'de
 * kapalıdır, çünkü derin bağlantılar uygulamanın kendi yönlendirme
 * katmanında doğrulanarak işlenir. Bu fonksiyon o katmanın eksik kalan
 * adımıdır: o olmadan `cairn://auth/callback` açılır ama oturum açılmaz.
 *
 * Kod tek kullanımlıktır ve hassastır: log'a, hata raporuna veya arayüze
 * yazılmaz.
 */
export const completeMagicLink = async (code: string): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  if (code.length === 0) return { ok: false, code: 'unauthenticated' };

  try {
    const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(code);

    if (error !== null && error !== undefined) {
      // Kodun kendisi değil, yalnız HTTP durumu loglanır.
      logger.warn('magic_link_exchange_failed', { code: error.status ?? 0 });
      return { ok: false, code: toErrorCode(error) };
    }

    if (data?.session === null || data?.session === undefined) {
      // Hata yok ama oturum da yok: kullanıcıyı "girdin" diye içeri almak,
      // bir sonraki isteğin sessizce 401 dönmesi demektir.
      logger.warn('magic_link_exchange_empty');
      return { ok: false, code: 'unauthenticated' };
    }

    logger.info('magic_link_exchanged');
    return { ok: true, data: null };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * Oturumu kapatır ve tüm yerel artıkları temizler.
 *
 * Sıra bilinçlidir: önce sunucu oturumu geçersizlenir, sonra yerel izler
 * silinir, en son bellekteki istemci bırakılır. Sunucu adımı başarısız olsa
 * bile yerel temizlik yapılır — cihazda kalan token, sunucudaki oturumdan
 * daha büyük risktir.
 */
export const signOut = async (): Promise<AuthResult<{ readonly failedSteps: number }>> => {
  let serverSignOutFailed = false;

  if (isSupabaseConfigured) {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error !== null) serverSignOutFailed = true;
    } catch {
      serverSignOutFailed = true;
    }
  }

  const { failedSteps } = await clearSessionArtifacts();
  resetSupabaseClient();

  logger.info('sign_out_completed', {
    serverSignOutFailed,
    failedSteps,
  });

  return { ok: true, data: { failedSteps: failedSteps + (serverSignOutFailed ? 1 : 0) } };
};

/** Yeni çember kurar ve kurucusunu owner yapar (atomik RPC). */
export const createCircle = async (
  careRecipientName: string,
  timezone: string,
): Promise<AuthResult<string>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  try {
    const { data, error } = await getSupabaseClient().rpc('create_circle_with_owner', {
      care_recipient_name: careRecipientName,
      circle_timezone: timezone,
    });

    if (error !== null) {
      logger.warn('create_circle_failed', { code: error.code ?? '' });
      return { ok: false, code: toErrorCode(error) };
    }

    const parsed = uuidSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn('create_circle_parse_failed', { schema: 'uuid' });
      return { ok: false, code: 'unknown' };
    }

    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * Davet oluşturur.
 *
 * Ham token çağırana döner ve YALNIZ paylaşım bağlantısında kullanılır.
 * Sunucuya yalnız hash gider.
 */
export const createInvitation = async (
  circleId: string,
  plainToken: string,
  role: 'caregiver' | 'viewer' = 'caregiver',
): Promise<AuthResult<string>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  const tokenHash = await hashInvitationToken(plainToken);
  if (!isValidTokenHash(tokenHash)) {
    return { ok: false, code: 'unknown' };
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('create_circle_invitation', {
      target_circle_id: circleId,
      invitation_token_hash: tokenHash,
      invited_role: role,
    });

    if (error !== null) {
      logger.warn('create_invitation_failed', { code: error.code ?? '' });
      return { ok: false, code: toErrorCode(error) };
    }

    const parsed = uuidSchema.safeParse(data);
    if (!parsed.success) return { ok: false, code: 'unknown' };

    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, code: 'network' };
  }
};

/**
 * Daveti kabul eder.
 *
 * Sunucudaki tek atomik işlem hash eşleşmesini, süreyi, tüketim durumunu ve
 * üyelik oluşturmayı birlikte yapar; istemcide yarış penceresi yoktur.
 */
export const acceptInvitation = async (plainToken: string): Promise<AuthResult<string>> => {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };

  const tokenHash = await hashInvitationToken(plainToken);
  if (!isValidTokenHash(tokenHash)) {
    return { ok: false, code: 'invitation_invalid' };
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('accept_circle_invitation', {
      invitation_token_hash: tokenHash,
    });

    if (error !== null) {
      // Davet tokenı veya hash'i HİÇBİR koşulda loglanmaz.
      logger.warn('accept_invitation_failed', { code: error.code ?? '' });
      return { ok: false, code: toErrorCode(error) };
    }

    const parsed = uuidSchema.safeParse(data);
    if (!parsed.success) return { ok: false, code: 'unknown' };

    logger.info('invitation_accepted');
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, code: 'network' };
  }
};
