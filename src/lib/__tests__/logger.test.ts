import { shouldLog } from '../logger';

describe('shouldLog', () => {
  it('geliştirmede tüm seviyeleri geçirir', () => {
    // Arrange
    const development = true;

    // Act & Assert
    expect(shouldLog('debug', development)).toBe(true);
    expect(shouldLog('error', development)).toBe(true);
  });

  it('üretimde debug ve info seviyelerini engeller', () => {
    // Arrange
    const development = false;

    // Act & Assert
    expect(shouldLog('debug', development)).toBe(false);
    expect(shouldLog('info', development)).toBe(false);
  });

  it('üretimde warn ve error seviyelerini geçirir', () => {
    // Arrange
    const development = false;

    // Act & Assert
    expect(shouldLog('warn', development)).toBe(true);
    expect(shouldLog('error', development)).toBe(true);
  });
});
