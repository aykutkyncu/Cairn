import { render } from '@testing-library/react-native';

import IndexScreen from '../index';

describe('IndexScreen', () => {
  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    // Arrange & Act
    const { getByRole } = await render(<IndexScreen />);

    // Assert
    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });
});
