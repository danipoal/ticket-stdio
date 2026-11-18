import { friendlyJoinError, historyLabel } from '../sheetHistory';

describe('historyLabel', () => {
  it.each([
    [null, 1, 'Creada'],
    [undefined, 1, 'Creada'],
    [1, 2, 'Aprobada'],
    [1, 3, 'Rechazada'],
    [3, 1, 'Reenviada a aprobación'],
    [1, 9, 'Cambio de estado'],
  ])('%p -> %p = %s', (from, to, label) => {
    expect(historyLabel({ from_status: from as any, to_status: to as number })).toBe(label);
  });
});

describe('friendlyJoinError', () => {
  it.each([
    ['Codigo de empresa no valido', 'Código de empresa no válido'],
    ['Ya tienes un perfil', 'Ya tienes un perfil creado'],
    ['Introduce tu nombre', 'Introduce tu nombre'],
    ['Hace falta iniciar sesion', 'Tu sesión ha caducado. Vuelve a iniciar sesión'],
    ['JWT expired', 'Tu sesión ha caducado. Vuelve a iniciar sesión'],
  ])('%s', (input, out) => {
    expect(friendlyJoinError(input)).toBe(out);
  });
  it('mensaje desconocido o vacio -> generico, sin filtrar texto interno', () => {
    for (const x of ['relation "x" does not exist', '', null, undefined]) {
      expect(friendlyJoinError(x as any)).toBe('No se pudo completar el alta. Inténtalo de nuevo');
    }
  });
});
