import {
  canInvite,
  canWrite,
  circleListSchema,
  roleLabel,
  toCircleSummary,
} from '../circle-schema';

describe('circleListSchema', () => {
  const validRow = {
    role: 'owner',
    circles: {
      id: '11111111-1111-4111-8111-111111111111',
      care_recipient_name: 'Fatma Demir',
      timezone: 'Europe/Istanbul',
      default_currency: 'TRY',
    },
  };

  it('geçerli satırı kabul eder', () => {
    expect(circleListSchema.safeParse([validRow]).success).toBe(true);
  });

  it('bilinmeyen rolü reddeder', () => {
    // Sunucuya yeni bir rol eklenirse istemci sessizce yanlış yetki
    // varsaymaz; sınırda durur.
    const parsed = circleListSchema.safeParse([{ ...validRow, role: 'admin' }]);
    expect(parsed.success).toBe(false);
  });

  it('boş bakılan kişi adını reddeder', () => {
    const parsed = circleListSchema.safeParse([
      { ...validRow, circles: { ...validRow.circles, care_recipient_name: '' } },
    ]);
    expect(parsed.success).toBe(false);
  });

  it('sunucu sütun adlarını arayüz biçimine çevirir', () => {
    const parsed = circleListSchema.parse([validRow]);
    const summary = toCircleSummary(parsed[0]!);

    expect(summary).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      careRecipientName: 'Fatma Demir',
      timezone: 'Europe/Istanbul',
      defaultCurrency: 'TRY',
      role: 'owner',
    });
  });
});

describe('rol yetkileri', () => {
  it('izleyici yazamaz', () => {
    expect(canWrite('viewer')).toBe(false);
    expect(canWrite('caregiver')).toBe(true);
    expect(canWrite('owner')).toBe(true);
  });

  it('yalnız sorumlu davet edebilir', () => {
    expect(canInvite('owner')).toBe(true);
    expect(canInvite('caregiver')).toBe(false);
    expect(canInvite('viewer')).toBe(false);
  });

  it('her rolün Türkçe adı vardır', () => {
    expect(roleLabel('owner')).toBe('Sorumlu');
    expect(roleLabel('caregiver')).toBe('Bakım veren');
    expect(roleLabel('viewer')).toBe('İzleyici');
  });
});
