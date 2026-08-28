import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { themes, type Theme, type ThemeName } from './theme';

/** Kullanıcının tema tercihi. 'system' cihaz ayarını izler. */
export type ThemePreference = ThemeName | 'system';

type ThemeContextValue = {
  readonly theme: Theme;
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const resolveThemeName = (
  preference: ThemePreference,
  systemScheme: ColorSchemeName | null | undefined,
): ThemeName => {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
};

type ThemeProviderProps = {
  readonly children: ReactNode;
  /** Başlangıç tercihi. Varsayılan olarak sistem teması izlenir. */
  readonly initialPreference?: ThemePreference;
};

export function ThemeProvider({ children, initialPreference = 'system' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  const value = useMemo<ThemeContextValue>(() => {
    const name = resolveThemeName(preference, systemScheme);
    return { theme: themes[name], preference, setPreference };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Aktif temayı döndürür.
 *
 * ThemeProvider dışında çağrılırsa sessizce varsayılana düşmez; bu, temasız
 * render edilen bir ağacın fark edilmeden yayına çıkmasını engeller.
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme yalnız ThemeProvider içinde kullanılabilir.');
  }
  return context.theme;
}

/** Tema tercihini okumak ve değiştirmek için. */
export function useThemePreference(): Omit<ThemeContextValue, 'theme'> {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useThemePreference yalnız ThemeProvider içinde kullanılabilir.');
  }
  return { preference: context.preference, setPreference: context.setPreference };
}
