import { parseAtBoundary } from '@/lib/boundary';
import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import { circleListSchema, toCircleSummary, type CircleSummary } from './circle-schema';

/**
 * Çember veri erişimi.
 *
 * Ekranlar bu modülü de doğrudan çağırmaz; `use-circles` hook'undan geçer.
 * Katman sırası: ekran → hook → repository → Supabase.
 */

/** Arayüzün ele alabileceği, hassas ayrıntı taşımayan hata kodları. */
export type CircleErrorCode = 'not_configured' | 'unauthenticated' | 'invalid_response' | 'network';

/** Repository hatası. `code` dışında hiçbir alan taşımaz. */
export class CircleError extends Error {
  readonly code: CircleErrorCode;

  constructor(code: CircleErrorCode) {
    // Mesaj kodun kendisidir: serbest metin, bir gün hassas içerik taşır.
    super(code);
    this.name = 'CircleError';
    this.code = code;
  }
}

/**
 * Kullanıcının aktif üyeliği olan çemberleri getirir.
 *
 * RLS zaten yalnız kullanıcının üyeliklerini döndürür; buradaki filtreler
 * güvenlik için değil, silinmiş ve bekleyen üyelikleri listeden çıkarmak
 * içindir. Güvenlik sunucudadır.
 */
export const listCircles = async (): Promise<readonly CircleSummary[]> => {
  if (!isSupabaseConfigured) throw new CircleError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };

  try {
    response = await getSupabaseClient()
      .from('circle_members')
      .select('role, circles!inner(id, care_recipient_name, timezone, default_currency)')
      .eq('invitation_state', 'active')
      .is('deleted_at', null)
      .is('circles.deleted_at', null);
  } catch {
    throw new CircleError('network');
  }

  if (response.error !== null) {
    logger.warn('list_circles_failed', { code: response.error.code ?? '' });
    throw new CircleError(response.error.code === '42501' ? 'unauthenticated' : 'network');
  }

  const parsed = parseAtBoundary(circleListSchema, 'circle_list', 'list_circles', response.data);
  if (!parsed.ok) throw new CircleError('invalid_response');

  return parsed.data.map(toCircleSummary);
};

/**
 * Çemberin aktif üye sayısı.
 *
 * Arayüz metinleri buna göre değişir: tek kullanıcıya "çemberdeki herkes
 * görür" demek, karşılığı olmayan bir söz vermektir. Sözleşme bunu
 * yasaklar.
 *
 * Sayı güvenlik kararı için KULLANILMAZ; yalnız metin seçer. Yetki RLS'tedir.
 */
export const countCircleMembers = async (circleId: string): Promise<number> => {
  if (!isSupabaseConfigured) throw new CircleError('not_configured');

  let response: { count: number | null; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('circle_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('invitation_state', 'active')
      .is('deleted_at', null);
  } catch {
    throw new CircleError('network');
  }

  if (response.error !== null) {
    logger.warn('count_circle_members_failed', { code: response.error.code ?? '' });
    throw new CircleError(response.error.code === '42501' ? 'unauthenticated' : 'network');
  }

  // Sayı okunamadıysa 1 varsayılır: paylaşımdan söz etmemek, olmayan bir
  // paylaşımı varmış gibi anlatmaktan iyidir.
  return response.count ?? 1;
};
