/**
 * 主题上下文 - 管理全局主题状态
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ConfigProvider, type ThemeConfig } from 'antd';
import { themeConfig, type ThemeName } from '../theme';

interface ThemeContextValue {
  themeName: ThemeName;
  theme: ThemeConfig;
  switchTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeName, setThemeName] = useState<ThemeName>('clean');

  const switchTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
  }, []);

  const value: ThemeContextValue = {
    themeName,
    theme: themeConfig[themeName].theme,
    switchTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={value.theme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
