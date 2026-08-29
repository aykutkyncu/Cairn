import { logger } from '@/lib/logger';
import { isErrorReporterConfigured, scrubEvent } from '@/lib/error-reporting';

/**
 * Hata sınırından gelen hatayı raporlanabilir hale getirir.
 *
 * Hatanın MESAJI ve yığın izi kasıtlı olarak taşınmaz: bir render hatası
 * çoğu zaman render edilen değeri (bir ilaç adı, bir not) mesajın içinde
 * taşır. Taşınan tek şey hatanın SINIFI ve hangi bileşende oluştuğudur.
 *
 * Bileşen yığınının yalnız en üstteki bileşen adı alınır; tam yığın uzun
 * olduğu kadar, prop değerlerini de içerebilir.
 */

/** Bileşen yığınından yalnız ilk bileşen adını çıkarır. */
export const topComponentName = (componentStack: string): string => {
  const firstLine = componentStack.trim().split('\n')[0] ?? '';
  const match = /^\s*(?:in|at)\s+([A-Za-z0-9_$.]+)/.exec(firstLine);
  return match?.[1] ?? 'bilinmiyor';
};

export const reportBoundaryError = (error: Error, componentStack: string): void => {
  const component = topComponentName(componentStack);

  logger.error('render_boundary_caught', {
    errorName: error.name,
    component,
  });

  if (!isErrorReporterConfigured) return;

  // Raporlayıcı eklendiğinde gönderilecek yük. Mesaj ve yığın izi burada da
  // taşınmaz; scrubEvent yalnız izin listesindeki etiketleri geçirir.
  scrubEvent({
    message: 'render_boundary_caught',
    level: 'error',
    tags: { event: 'render_boundary_caught', screen: component },
  });
};
