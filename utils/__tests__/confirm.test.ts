import { Alert, Platform } from 'react-native';
import { confirmAction } from '../confirm';

describe('confirmAction', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
    delete (global as any).window;
  });

  it('web: usa window.confirm y devuelve su resultado', async () => {
    Platform.OS = 'web';
    (global as any).window = { confirm: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false) };
    expect(await confirmAction('T', 'M')).toBe(true);
    expect(await confirmAction('T', 'M')).toBe(false);
    expect((global as any).window.confirm).toHaveBeenCalledWith('T\n\nM');
  });

  it('web sin window.confirm: no confirma (falla seguro)', async () => {
    Platform.OS = 'web';
    (global as any).window = {};
    expect(await confirmAction('T', 'M')).toBe(false);
  });

  it('movil: Cancelar -> false, Eliminar -> true', async () => {
    Platform.OS = 'android';
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => {
      buttons[0].onPress();
    });
    expect(await confirmAction('T', 'M')).toBe(false);
    spy.mockImplementation((_t, _m, buttons: any) => {
      buttons[1].onPress();
    });
    expect(await confirmAction('T', 'M', 'Borrar')).toBe(true);
    expect((spy.mock.calls[1][2] as any)[1].text).toBe('Borrar');
  });

  it('movil: descartar el dialogo cuenta como cancelar', async () => {
    Platform.OS = 'ios';
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, opts: any) => {
      opts.onDismiss();
    });
    expect(await confirmAction('T', 'M')).toBe(false);
  });
});
