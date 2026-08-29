import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from './button';
import { ErrorState } from './error-state';
import { useTheme } from './theme-provider';

/**
 * Hata sınırı.
 *
 * Sözleşme gereği kullanıcıya **teknik hata metni ve sağlık verisi
 * gösterilmez**. Yakalanan hatanın mesajı ekrana basılmaz: bir React hatası
 * çoğu zaman render edilen veriyi (bir ilaç adını, bir notu) mesajın içinde
 * taşır. Kullanıcı yalnız ne olduğunu ve ne yapabileceğini görür.
 *
 * Raporlama kancası `onError` ile dışarıdan verilir; bu bileşen bir
 * raporlayıcıya bağımlı değildir.
 */

export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  /**
   * Hata raporlama kancası.
   *
   * Buraya ham hata verilir; temizlik `src/lib/error-reporting` katmanının
   * sorumluluğudur. Bu bileşen hatayı kendi başına hiçbir yere göndermez.
   */
  readonly onError?: (error: Error, componentStack: string) => void;
  /** Kullanıcı "ana ekrana dön" dediğinde çalışır. */
  readonly onGoHome?: () => void;
};

type ErrorBoundaryState = {
  readonly hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info.componentStack ?? '');
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private readonly handleGoHome = (): void => {
    this.setState({ hasError: false });
    this.props.onGoHome?.();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorBoundaryFallback
        onRetry={this.handleRetry}
        onGoHome={this.props.onGoHome === undefined ? undefined : this.handleGoHome}
      />
    );
  }
}

type FallbackProps = {
  readonly onRetry: () => void;
  readonly onGoHome?: (() => void) | undefined;
};

/** Hata ekranı. Tema tokenlarına erişmek için ayrı bir işlev bileşenidir. */
function ErrorBoundaryFallback({ onRetry, onGoHome }: FallbackProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.md,
        justifyContent: 'center',
      }}
    >
      <ErrorState
        title="Bir şeyler ters gitti"
        description="Bu ekran açılamadı. Verilerin yerinde duruyor. Tekrar denemek istersen aşağıdaki düğmeyi kullanabilirsin."
        retryLabel="Tekrar dene"
        onRetry={onRetry}
      />
      {onGoHome === undefined ? null : (
        <View style={{ alignItems: 'center' }}>
          <Button label="Ana ekrana dön" onPress={onGoHome} variant="ghost" />
        </View>
      )}
    </View>
  );
}
