import { render, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Input } from '../input';
import { ThemeProvider, type ThemePreference } from '../theme-provider';

function wrap(ui: React.ReactElement, preference: ThemePreference = 'light') {
  return render(<ThemeProvider initialPreference={preference}>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('erişilebilir ad ve rol taşır', async () => {
    // Arrange & Act
    const { getByRole } = await wrap(<Button label="Görevi tamamla" onPress={() => undefined} />);

    // Assert
    expect(getByRole('button', { name: 'Görevi tamamla' })).toBeTruthy();
  });

  it('devre dışıyken erişilebilirlik durumunu bildirir ve basılamaz', async () => {
    // Arrange
    const onPress = jest.fn();

    // Act
    const { getByRole } = await wrap(<Button disabled label="Kaydet" onPress={onPress} />);
    const button = getByRole('button', { name: 'Kaydet' });

    // Assert
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('yüklenirken meşgul durumunu ve yükleme metnini duyurur', async () => {
    // Arrange & Act
    const { getByRole } = await wrap(
      <Button label="Kaydet" loading loadingLabel="Kaydediliyor" onPress={() => undefined} />,
    );

    // Assert: durum yalnız dönen göstergeyle değil, metin ve durumla da anlatılır.
    const button = getByRole('button', { name: 'Kaydediliyor' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('dokunma hedefi 44 pt altına inmez', async () => {
    // Arrange & Act
    const { getByTestId } = await wrap(
      <Button label="Kısa" onPress={() => undefined} testID="short-button" />,
    );

    // Assert
    const style = getByTestId('short-button').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('Input', () => {
  it('görünür etiketi erişilebilir ad olarak kullanır', async () => {
    // Arrange & Act
    const { getByLabelText } = await wrap(<Input label="Bakılan kişinin adı" />);

    // Assert
    expect(getByLabelText('Bakılan kişinin adı')).toBeTruthy();
  });

  it('zorunlu alanı erişilebilir adda belirtir', async () => {
    // Arrange & Act
    const { getByLabelText } = await wrap(<Input label="E-posta" required />);

    // Assert
    expect(getByLabelText('E-posta, zorunlu')).toBeTruthy();
  });

  it('hata durumunu renkle değil, görünür metinle de anlatır', async () => {
    // Arrange & Act
    const { getByText, getByLabelText } = await wrap(
      <Input errorMessage="Geçerli bir e-posta adresi gir." label="E-posta" />,
    );

    // Assert
    expect(getByText('Hata: Geçerli bir e-posta adresi gir.')).toBeTruthy();
    expect(getByLabelText('E-posta').props.accessibilityHint).toBe(
      'Geçerli bir e-posta adresi gir.',
    );
  });
});

describe('Checkbox', () => {
  it('checkbox rolü ve seçili durumu bildirir', async () => {
    // Arrange & Act
    const { getByRole } = await wrap(
      <Checkbox checked label="Sabah ilacı verildi" onChange={() => undefined} />,
    );

    // Assert
    const checkbox = getByRole('checkbox', { name: 'Sabah ilacı verildi' });
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('seçili olmayan durumu da erişilebilirlik durumunda bildirir', async () => {
    // Arrange & Act
    const { getByRole } = await wrap(
      <Checkbox checked={false} label="Akşam yürüyüşü" onChange={() => undefined} />,
    );

    // Assert
    expect(
      getByRole('checkbox', { name: 'Akşam yürüyüşü' }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('basıldığında değeri tersine çevirir', async () => {
    // Arrange
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <Checkbox checked={checked} label="Görev" onChange={setChecked} />;
    }

    // Act
    const user = userEvent.setup();
    const { getByRole } = await wrap(<Harness />);
    await user.press(getByRole('checkbox', { name: 'Görev' }));

    // Assert
    expect(getByRole('checkbox', { name: 'Görev' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });
});
