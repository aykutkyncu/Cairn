import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import IndexScreen from '../index';

describe('IndexScreen', () => {
  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    // Arrange & Act
    const { getByRole } = await render(
      <ThemeProvider initialPreference="light">
        <IndexScreen />
      </ThemeProvider>,
    );

    // Assert
    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });
});
