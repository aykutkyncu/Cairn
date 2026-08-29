import {
  activeCompletions,
  blockLabel,
  blockOfHour,
  buildDayPlan,
  progressSentence,
  type BuildDayPlanInput,
} from '../day-plan';
import type { Completion, Task } from '../task-schema';

/**
 * Gün planı testleri.
 *
 * Faz 05 kabul kriterleri:
 * - "Aynı circle zaman dilimindeki gün iki farklı cihazda aynı gün altında
 *   görünür."
 * - Geri alma mevcut completion'ı silmez; void kaydı üretir.
 */

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't-1',
  circleId: 'c-1',
  kind: 'medication',
  title: 'Metformin 850 mg',
  dtstartLocalDate: '2026-08-28',
  dtstartLocalTime: '08:00',
  rrule: null,
  untilLocalDate: null,
  assignedTo: null,
  ...overrides,
});

const completion = (overrides: Partial<Completion> = {}): Completion => ({
  id: 'comp-1',
  taskId: 't-1',
  occurrenceId: '2026-08-28T08:00:00+03:00',
  kind: 'done',
  completedAt: '2026-08-28T05:10:00.000Z',
  completedBy: 'u-1',
  voidsCompletionId: null,
  ...overrides,
});

const plan = (overrides: Partial<BuildDayPlanInput> = {}) =>
  buildDayPlan({
    tasks: [task()],
    completions: [],
    pendingKeys: new Set(),
    localDate: '2026-08-28',
    timeZone: 'Europe/Istanbul',
    now: new Date('2026-08-28T05:00:00Z'),
    ...overrides,
  });

describe('blockOfHour', () => {
  it('saati günün bölümüne eşler', () => {
    expect(blockOfHour(3)).toBe('night');
    expect(blockOfHour(8)).toBe('morning');
    expect(blockOfHour(13)).toBe('noon');
    expect(blockOfHour(19)).toBe('evening');
    expect(blockOfHour(23)).toBe('night');
  });

  it('sınır saatlerini sonraki bloğa verir', () => {
    expect(blockOfHour(5)).toBe('morning');
    expect(blockOfHour(11)).toBe('noon');
    expect(blockOfHour(17)).toBe('evening');
    expect(blockOfHour(22)).toBe('night');
  });

  it('her bloğun Türkçe adı vardır', () => {
    expect(blockLabel('morning')).toBe('Sabah');
    expect(blockLabel('noon')).toBe('Öğle');
    expect(blockLabel('evening')).toBe('Akşam');
    expect(blockLabel('night')).toBe('Gece');
  });
});

describe('activeCompletions', () => {
  it('void edilmiş tamamlamayı geçerli saymaz', () => {
    // Geri alma completion'ı SİLMEZ; void kaydı onu geçersizler.
    const done = completion({ id: 'comp-1' });
    const undo = completion({ id: 'comp-2', kind: 'void', voidsCompletionId: 'comp-1' });

    const active = activeCompletions([done, undo]);

    expect(active.size).toBe(0);
  });

  it('void edilmemiş tamamlamayı korur', () => {
    const active = activeCompletions([completion()]);

    expect(active.get('t-1|2026-08-28T08:00:00+03:00')?.id).toBe('comp-1');
  });

  it('başka bir tamamlamayı void eden kayıt diğerini etkilemez', () => {
    const first = completion({ id: 'comp-1', occurrenceId: '2026-08-28T08:00:00+03:00' });
    const second = completion({ id: 'comp-2', occurrenceId: '2026-08-28T20:00:00+03:00' });
    const undo = completion({ id: 'comp-3', kind: 'void', voidsCompletionId: 'comp-1' });

    const active = activeCompletions([first, second, undo]);

    expect(active.size).toBe(1);
    expect(active.get('t-1|2026-08-28T20:00:00+03:00')?.id).toBe('comp-2');
  });
});

describe('buildDayPlan', () => {
  it('günün görevini doğru blokta gösterir', () => {
    const result = plan();

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block).toBe('morning');
    expect(result.blocks[0]?.items[0]).toMatchObject({
      title: 'Metformin 850 mg',
      localTime: '08:00',
      occurrenceId: '2026-08-28T08:00:00+03:00',
      isCompleted: false,
    });
  });

  it('günde üç kez ilacı üç ayrı blokta gösterir', () => {
    const result = plan({
      tasks: [
        task({ id: 't-morning', dtstartLocalTime: '08:00', rrule: 'FREQ=DAILY' }),
        task({ id: 't-noon', dtstartLocalTime: '14:00', rrule: 'FREQ=DAILY' }),
        task({ id: 't-evening', dtstartLocalTime: '20:00', rrule: 'FREQ=DAILY' }),
      ],
    });

    expect(result.blocks.map((group) => group.block)).toEqual(['morning', 'noon', 'evening']);
    expect(result.total).toBe(3);
  });

  it('aynı bloktaki görevleri saate göre sıralar', () => {
    const result = plan({
      tasks: [
        task({ id: 't-late', dtstartLocalTime: '10:00', title: 'Geç' }),
        task({ id: 't-early', dtstartLocalTime: '06:00', title: 'Erken' }),
      ],
    });

    expect(result.blocks[0]?.items.map((item) => item.title)).toEqual(['Erken', 'Geç']);
  });

  it('çember saat dilimine göre occurrence kimliği üretir', () => {
    // Aynı görev, farklı çember zaman dilimi: kimlik ofseti değişir.
    const istanbul = plan();
    const berlin = plan({ timeZone: 'Europe/Berlin' });

    expect(istanbul.blocks[0]?.items[0]?.occurrenceId).toBe('2026-08-28T08:00:00+03:00');
    expect(berlin.blocks[0]?.items[0]?.occurrenceId).toBe('2026-08-28T08:00:00+02:00');
  });

  it('cihaz saat diliminden bağımsızdır', () => {
    // İki farklı cihazda aynı çember için üretilen plan birebir aynıdır.
    const first = plan();
    const second = plan();

    expect(first.blocks[0]?.items[0]?.occurrenceId).toBe(second.blocks[0]?.items[0]?.occurrenceId);
  });

  it('tamamlanmış görevi işaretler', () => {
    const result = plan({ completions: [completion()] });

    expect(result.blocks[0]?.items[0]).toMatchObject({
      isCompleted: true,
      completionId: 'comp-1',
    });
    expect(result.completed).toBe(1);
  });

  it('geri alınmış tamamlamayı tamamlanmamış sayar', () => {
    const result = plan({
      completions: [
        completion({ id: 'comp-1' }),
        completion({ id: 'comp-2', kind: 'void', voidsCompletionId: 'comp-1' }),
      ],
    });

    expect(result.blocks[0]?.items[0]?.isCompleted).toBe(false);
    expect(result.completed).toBe(0);
  });

  it('kuyrukta bekleyen tamamlamayı beklemede olarak gösterir', () => {
    const result = plan({
      pendingKeys: new Set(['t-1|2026-08-28T08:00:00+03:00']),
    });

    const item = result.blocks[0]?.items[0];
    expect(item?.isPending).toBe(true);
    expect(item?.isCompleted).toBe(false);
    expect(result.completed).toBe(1);
  });

  it('zamanı geçmiş ve tamamlanmamış görevi gecikenlere koyar', () => {
    const result = plan({ now: new Date('2026-08-28T12:00:00Z') });

    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0]?.taskId).toBe('t-1');
  });

  it('zamanı gelmemiş görevi geciken saymaz', () => {
    const result = plan({ now: new Date('2026-08-28T04:00:00Z') });

    expect(result.overdue).toHaveLength(0);
  });

  it('tamamlanmış görevi geciken saymaz', () => {
    const result = plan({
      completions: [completion()],
      now: new Date('2026-08-28T12:00:00Z'),
    });

    expect(result.overdue).toHaveLength(0);
  });

  it('kuyrukta bekleyeni geciken saymaz', () => {
    // Kullanıcı işi yaptı; bağlantı yok diye onu "geciken" göstermek yanlıştır.
    const result = plan({
      pendingKeys: new Set(['t-1|2026-08-28T08:00:00+03:00']),
      now: new Date('2026-08-28T12:00:00Z'),
    });

    expect(result.overdue).toHaveLength(0);
  });

  it('başka güne ait görevi göstermez', () => {
    const result = plan({ localDate: '2026-08-29' });

    expect(result.total).toBe(0);
    expect(result.blocks).toHaveLength(0);
  });

  it('DST geçiş gününde görevi bir kez gösterir', () => {
    // Berlin'de 25 Ekim 2026: 02:30 iki kez yaşanır.
    const result = plan({
      tasks: [
        task({ dtstartLocalDate: '2026-10-01', dtstartLocalTime: '02:30', rrule: 'FREQ=DAILY' }),
      ],
      localDate: '2026-10-25',
      timeZone: 'Europe/Berlin',
    });

    expect(result.total).toBe(1);
    expect(result.blocks[0]?.items[0]?.occurrenceId).toBe('2026-10-25T02:30:00+02:00');
  });

  it('görev yoksa boş plan üretir', () => {
    const result = plan({ tasks: [] });

    expect(result).toMatchObject({ total: 0, completed: 0, blocks: [], overdue: [] });
  });
});

describe('progressSentence', () => {
  it('boş günde planlanmış iş olmadığını söyler', () => {
    expect(progressSentence(plan({ tasks: [] }))).toBe('Bugün için planlanmış bir şey yok.');
  });

  it('hiç tamamlanmamışsa sakin bir cümle kurar', () => {
    expect(progressSentence(plan())).toBe('Bugün 1 iş var. Henüz başlanmadı.');
  });

  it('kısmi ilerlemeyi tek cümlede anlatır', () => {
    const result = plan({
      tasks: [task({ id: 't-1' }), task({ id: 't-2', dtstartLocalTime: '20:00' })],
      completions: [completion()],
    });

    expect(progressSentence(result)).toBe('Bugün 2 işten 1 tanesi tamam.');
  });

  it('gün bittiğinde bunu açıkça söyler', () => {
    expect(progressSentence(plan({ completions: [completion()] }))).toBe('Bugünün her işi tamam.');
  });
});
