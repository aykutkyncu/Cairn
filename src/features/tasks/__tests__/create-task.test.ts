import { createTask, rruleForPreset, validateTaskInput, validationMessage } from '../create-task';

/**
 * Görev oluşturma testleri.
 *
 * Faz 05 kabul kriteri: "Günde üç kez tekrarlayan ilaç görevi TEK kural
 * satırıdır." Aşağıdaki testler, sunucuya yazılan yükün occurrence değil
 * kural taşıdığını sabitler.
 */

const mockInsertResult = jest.fn();
const mockIsConfigured = jest.fn(() => true);
const mockInsertSpy = jest.fn();

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured();
  },
  getSupabaseClient: () => ({
    from: () => ({
      insert: (payload: unknown) => {
        mockInsertSpy(payload);
        return {
          select: () => ({
            single: () => mockInsertResult(),
          }),
        };
      },
    }),
  }),
}));

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';

const input = (overrides: Record<string, unknown> = {}) => ({
  circleId: CIRCLE_ID,
  kind: 'medication' as const,
  title: 'Sabah ilacı',
  localDate: '2026-08-28',
  localTime: '08:00',
  recurrence: 'daily' as const,
  assignedTo: null,
  ...overrides,
});

const serverRow = {
  id: TASK_ID,
  circle_id: CIRCLE_ID,
  kind: 'medication',
  title: 'Sabah ilacı',
  dtstart_local_date: '2026-08-28',
  dtstart_local_time: '08:00:00',
  rrule: 'FREQ=DAILY',
  recurrence_until_local_date: null,
  assigned_to: null,
};

describe('validateTaskInput', () => {
  it('geçerli girdiyi kabul eder', () => {
    expect(validateTaskInput(input())).toEqual([]);
  });

  it('boş başlığı reddeder', () => {
    expect(validateTaskInput(input({ title: '   ' }))).toContain('title_empty');
  });

  it('çok uzun başlığı reddeder', () => {
    expect(validateTaskInput(input({ title: 'x'.repeat(301) }))).toContain('title_too_long');
  });

  it('bozuk tarihi reddeder', () => {
    expect(validateTaskInput(input({ localDate: '28.08.2026' }))).toContain('date_invalid');
  });

  it('bozuk ve olmayan saatleri reddeder', () => {
    expect(validateTaskInput(input({ localTime: '8:00' }))).toContain('time_invalid');
    expect(validateTaskInput(input({ localTime: '25:00' }))).toContain('time_invalid');
    expect(validateTaskInput(input({ localTime: '08:75' }))).toContain('time_invalid');
  });

  it('her sorunun Türkçe karşılığı vardır', () => {
    for (const issue of [
      'title_empty',
      'title_too_long',
      'date_invalid',
      'time_invalid',
    ] as const) {
      expect(validationMessage(issue).length).toBeGreaterThan(0);
    }
  });
});

describe('rruleForPreset', () => {
  it('hazır seçenekleri kurala çevirir', () => {
    expect(rruleForPreset('once')).toBeNull();
    expect(rruleForPreset('daily')).toBe('FREQ=DAILY');
    expect(rruleForPreset('weekdays')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(rruleForPreset('weekly')).toBe('FREQ=WEEKLY');
  });

  it('özel seçenekte verilen kuralı kullanır', () => {
    expect(rruleForPreset('custom', 'FREQ=DAILY;INTERVAL=3')).toBe('FREQ=DAILY;INTERVAL=3');
    expect(rruleForPreset('custom')).toBeNull();
  });
});

describe('createTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
    mockInsertResult.mockResolvedValue({ data: serverRow, error: null });
  });

  it('tek kural satırı yazar, occurrence üretmez', async () => {
    // Act
    await createTask(input());

    // Assert: yük bir kural taşır; gün gün satır yoktur.
    expect(mockInsertSpy).toHaveBeenCalledTimes(1);
    expect(mockInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rrule: 'FREQ=DAILY',
        dtstart_local_date: '2026-08-28',
        dtstart_local_time: '08:00',
      }),
    );
  });

  it('başlığı kırparak gönderir', async () => {
    await createTask(input({ title: '  Sabah ilacı  ' }));

    expect(mockInsertSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sabah ilacı' }));
  });

  it('tek seferlik görevde kural yazmaz', async () => {
    mockInsertResult.mockResolvedValue({ data: { ...serverRow, rrule: null }, error: null });

    await createTask(input({ recurrence: 'once' }));

    expect(mockInsertSpy).toHaveBeenCalledWith(expect.objectContaining({ rrule: null }));
  });

  it('sunucu yanıtını arayüz biçimine çevirir', async () => {
    const task = await createTask(input());

    expect(task).toMatchObject({
      id: TASK_ID,
      circleId: CIRCLE_ID,
      title: 'Sabah ilacı',
      dtstartLocalTime: '08:00:00',
      rrule: 'FREQ=DAILY',
    });
  });

  it('geçersiz girdiyi sunucuya hiç göndermez', async () => {
    await expect(createTask(input({ title: '' }))).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(mockInsertSpy).not.toHaveBeenCalled();
  });

  it('yapılandırma yokken sunucuya gitmez', async () => {
    mockIsConfigured.mockReturnValue(false);

    await expect(createTask(input())).rejects.toMatchObject({ code: 'not_configured' });
    expect(mockInsertSpy).not.toHaveBeenCalled();
  });

  it('yetki hatasını ayrı bir kodla bildirir', async () => {
    mockInsertResult.mockResolvedValue({ data: null, error: { code: '42501' } });

    await expect(createTask(input())).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('şemaya uymayan yanıtı kabul etmez', async () => {
    mockInsertResult.mockResolvedValue({ data: { ...serverRow, kind: 'bilinmeyen' }, error: null });

    await expect(createTask(input())).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('hata nesnesi görev başlığını taşımaz', async () => {
    // Görev başlığı sağlık verisine işaret eder.
    mockInsertResult.mockResolvedValue({ data: null, error: { code: '42501' } });

    const error = await createTask(input({ title: 'Metformin 850 mg' })).catch(
      (caught: unknown) => caught,
    );

    expect(JSON.stringify({ message: (error as Error).message })).not.toContain('Metformin');
  });
});
