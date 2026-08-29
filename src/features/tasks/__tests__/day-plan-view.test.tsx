import { act, render, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { DayPlanView, UNDO_WINDOW_MS } from '../day-plan-view';
import type { DayPlan, PlannedOccurrence } from '../day-plan';

/**
 * Bugün ekranı görünüm testleri.
 *
 * Sınananlar: tek dokunuşla tamamlama, 10 saniyelik geri alma penceresi,
 * bekleyen kaydın "kaydedildi" değil "gönderilecek" olarak gösterilmesi ve
 * gecikenler alanının sakin tonu.
 */

const item = (overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence => ({
  taskId: 't-1',
  occurrenceId: '2026-08-28T08:00:00+03:00',
  title: 'Metformin 850 mg',
  kind: 'medication',
  assignedTo: null,
  localTime: '08:00',
  block: 'morning',
  completionId: null,
  isCompleted: false,
  isPending: false,
  ...overrides,
});

const plan = (overrides: Partial<DayPlan> = {}): DayPlan => ({
  localDate: '2026-08-28',
  blocks: [{ block: 'morning', items: [item()] }],
  overdue: [],
  total: 1,
  completed: 0,
  ...overrides,
});

const renderView = (props: Partial<Parameters<typeof DayPlanView>[0]> = {}) =>
  render(
    <ThemeProvider initialPreference="light">
      <DayPlanView plan={plan()} onComplete={() => undefined} onUndo={() => undefined} {...props} />
    </ThemeProvider>,
  );

describe('DayPlanView', () => {
  it('günün başlığını ve tek cümlelik özeti gösterir', async () => {
    const { getByRole, getByText } = await renderView();

    expect(getByRole('header', { name: 'Bugün' })).toBeTruthy();
    expect(getByText('Bugün 1 iş var. Henüz başlanmadı.')).toBeTruthy();
  });

  it('görevi bloğu altında gösterir', async () => {
    const { getByRole } = await renderView();

    expect(getByRole('header', { name: 'Sabah' })).toBeTruthy();
    expect(getByRole('checkbox', { name: '08:00 Metformin 850 mg' })).toBeTruthy();
  });

  it('boş günde görev ekleme çağrısı gösterir', async () => {
    const onAddTask = jest.fn();
    const { getByRole, getByText } = await renderView({
      plan: plan({ blocks: [], total: 0 }),
      onAddTask,
    });

    expect(getByText('Bugün için planlanmış bir şey yok.')).toBeTruthy();
    expect(getByRole('button', { name: 'Görev ekle' })).toBeTruthy();
  });

  it('tek dokunuşla tamamlar', async () => {
    // Arrange
    const onComplete = jest.fn();
    const user = userEvent.setup();
    const { getByRole } = await renderView({ onComplete });

    // Act
    await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg' }));

    // Assert
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ taskId: 't-1' });
  });

  it('işaretleme kaydedilmeden geri alma düğmesi göstermez', async () => {
    // Kuyruğa yazma başarısızsa plan değişmez; kullanıcıya geri alınacak bir
    // şey varmış gibi gösterilmez.
    const user = userEvent.setup();
    const { getByRole, queryByRole } = await renderView();

    await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg' }));

    expect(queryByRole('button', { name: /geri al/i })).toBeNull();
  });

  it('işaretleme kaydedilince geri alma düğmesi gösterir', async () => {
    // Gerçek akış: dokunuş -> kuyruğa yazıldı -> plan yenilendi.
    const user = userEvent.setup();
    const { getByRole, rerender } = await renderView();

    await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg' }));

    await act(async () => {
      rerender(
        <ThemeProvider initialPreference="light">
          <DayPlanView
            plan={plan({
              blocks: [{ block: 'morning', items: [item({ isPending: true })] }],
              completed: 1,
            })}
            onComplete={() => undefined}
            onUndo={() => undefined}
          />
        </ThemeProvider>,
      );
    });

    expect(getByRole('button', { name: /geri al/i })).toBeTruthy();
  });

  it('geri alma penceresi 10 saniye sonra kapanır', async () => {
    // Arrange
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { getByRole, queryByRole, rerender } = await renderView();

      await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg' }));
      await act(async () => {
        rerender(
          <ThemeProvider initialPreference="light">
            <DayPlanView
              plan={plan({
                blocks: [{ block: 'morning', items: [item({ isPending: true })] }],
                completed: 1,
              })}
              onComplete={() => undefined}
              onUndo={() => undefined}
            />
          </ThemeProvider>,
        );
      });

      // Assert: pencere açık.
      expect(getByRole('button', { name: /geri al/i })).toBeTruthy();

      // Act: süre dolar.
      await act(async () => {
        jest.advanceTimersByTime(UNDO_WINDOW_MS + 100);
      });

      // Assert: pencere kapandı; kayıt kalıcı sayılır.
      expect(queryByRole('button', { name: /geri al/i })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('geri al düğmesi geri alma çağrısını yapar', async () => {
    // Arrange
    const onUndo = jest.fn();
    const user = userEvent.setup();
    const marked = plan({
      blocks: [{ block: 'morning', items: [item({ isPending: true })] }],
      completed: 1,
    });
    const { getByRole, rerender } = await renderView({ onUndo });

    // Act
    await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg' }));
    await act(async () => {
      rerender(
        <ThemeProvider initialPreference="light">
          <DayPlanView plan={marked} onComplete={() => undefined} onUndo={onUndo} />
        </ThemeProvider>,
      );
    });
    await user.press(getByRole('button', { name: /geri al/i }));

    // Assert
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('bekleyen kaydı kaydedildi değil gönderilecek olarak gösterir', async () => {
    // Kalıcı kuyruğa yazılmış ama sunucuya ulaşmamış bir işaretleme.
    const { getByRole, getByText } = await renderView({
      plan: plan({ blocks: [{ block: 'morning', items: [item({ isPending: true })] }] }),
    });

    expect(getByText('Gönderilecek')).toBeTruthy();
    expect(
      getByRole('checkbox', {
        name: '08:00 Metformin 850 mg. Kaydedildi, bağlantı gelince gönderilecek',
      }),
    ).toBeTruthy();
  });

  it('sunucuda kayıtlı tamamlamayı tamam olarak gösterir', async () => {
    const { getByRole, getByText } = await renderView({
      plan: plan({
        blocks: [{ block: 'morning', items: [item({ isCompleted: true, completionId: 'c-1' })] }],
        completed: 1,
      }),
    });

    expect(getByText('Tamam')).toBeTruthy();
    expect(
      getByRole('checkbox', { name: '08:00 Metformin 850 mg. Tamamlandı' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true });
  });

  it('tamamlanmış görev yeniden tamamlanamaz', async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    const { getByRole } = await renderView({
      onComplete,
      plan: plan({
        blocks: [{ block: 'morning', items: [item({ isCompleted: true, completionId: 'c-1' })] }],
      }),
    });

    await user.press(getByRole('checkbox', { name: '08:00 Metformin 850 mg. Tamamlandı' }));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('gecikenleri sakin bir başlıkla gösterir', async () => {
    const overdueItem = item({ localTime: '06:00' });
    const { getByRole, getByText } = await renderView({
      plan: plan({ overdue: [overdueItem] }),
    });

    expect(getByRole('header', { name: 'Zamanı geçenler' })).toBeTruthy();
    // Ton suçlayıcı değildir.
    expect(getByText(/Bunlar hâlâ yapılabilir/)).toBeTruthy();
  });

  it('görev türünü etiketle gösterir', async () => {
    const { getByText } = await renderView();

    expect(getByText('İlaç')).toBeTruthy();
  });

  it('gün bittiğinde bunu duyurur', async () => {
    const { getByText } = await renderView({
      plan: plan({
        blocks: [{ block: 'morning', items: [item({ isCompleted: true })] }],
        completed: 1,
      }),
    });

    expect(getByText('Bugünün her işi tamam.')).toBeTruthy();
  });
});
