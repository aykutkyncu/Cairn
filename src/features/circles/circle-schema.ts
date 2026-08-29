import { z } from 'zod';

/**
 * Çember şemaları.
 *
 * Sunucudan gelen her satır kullanıldığı sınırda bu şemalarla doğrulanır.
 * Şema, tabloda var olan her sütunu değil, arayüzün GERÇEKTEN kullandığı
 * alanları tanımlar: kullanılmayan bir alanı taşımak, onu bir gün loga veya
 * hata raporuna düşürme riskini bedavaya satın almaktır.
 */

/** Çember rolleri. Veritabanındaki `public.circle_role` enum'u ile aynıdır. */
export const circleRoleSchema = z.enum(['owner', 'caregiver', 'viewer']);
export type CircleRole = z.infer<typeof circleRoleSchema>;

/**
 * Kullanıcının bir çemberdeki görünümü.
 *
 * `careRecipientName` özel nitelikli veriye işaret eder: yalnız arayüzde
 * gösterilir; log, analytics, push bildirimi ve hata raporuna yazılmaz.
 */
export const circleSummarySchema = z.object({
  role: circleRoleSchema,
  // Supabase gömülü ilişkiyi tekil nesne olarak döndürür (`circles!inner`).
  circles: z.object({
    id: z.string().uuid(),
    care_recipient_name: z.string().min(1).max(200),
    timezone: z.string().min(1),
    default_currency: z.string().length(3),
  }),
});

export type CircleSummaryRow = z.infer<typeof circleSummarySchema>;

export const circleListSchema = z.array(circleSummarySchema);

/** Arayüzün kullandığı biçim. Sunucu sütun adları buraya sızmaz. */
export type CircleSummary = {
  readonly id: string;
  readonly careRecipientName: string;
  readonly timezone: string;
  readonly defaultCurrency: string;
  readonly role: CircleRole;
};

export const toCircleSummary = (row: CircleSummaryRow): CircleSummary => ({
  id: row.circles.id,
  careRecipientName: row.circles.care_recipient_name,
  timezone: row.circles.timezone,
  defaultCurrency: row.circles.default_currency,
  role: row.role,
});

/** Rolün yazma yetkisi var mı? Viewer yalnız okur. */
export const canWrite = (role: CircleRole): boolean => role === 'owner' || role === 'caregiver';

/** Rolün üye davet etme yetkisi var mı? */
export const canInvite = (role: CircleRole): boolean => role === 'owner';

/** Rolün kullanıcıya gösterilecek Türkçe adı. */
export const roleLabel = (role: CircleRole): string => {
  switch (role) {
    case 'owner':
      return 'Sorumlu';
    case 'caregiver':
      return 'Bakım veren';
    case 'viewer':
      return 'İzleyici';
  }
};
