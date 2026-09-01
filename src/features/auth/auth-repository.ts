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
