import { isValidEmail, validateLine, validateSheet, LineInput } from '../validation';

const goodLine: LineInput = {
  title: 'Comida cliente',
  amount: '45,90',
  tax: '21',
  date: '2025-03-04',
  idPaymentType: '1',
  idCategory: '2',
  idSheet: 7,
};

describe('isValidEmail', () => {
  it.each(['a@b.co', 'dani.poal@wad.cat', ' x@y.es '])('%s valido', (e) => {
    expect(isValidEmail(e)).toBe(true);
  });
  it.each(['', 'a', 'a@b', 'a@@b.co', 'a b@c.co', '@b.co', 'a@.co'])('"%s" invalido', (e) => {
    expect(isValidEmail(e)).toBe(false);
  });
});

describe('validateLine', () => {
  it('acepta una linea correcta y construye el payload', () => {
    const r = validateLine(goodLine);
    expect(r).toEqual({
      ok: true,
      payload: {
        title: 'Comida cliente',
        amount: 45.9,
        date: '2025-03-04',
        tax: 21,
        foto: undefined,
        id_payment_type: '1',
        id_category: '2',
        id_sheet: '7',
      },
    });
  });

  it('REGRESION: importe con coma se guarda como numero, no como null', () => {
    const r = validateLine({ ...goodLine, amount: '12,5' });
    expect(r.ok && r.payload.amount).toBe(12.5);
  });

  it('redondea a 2 decimales', () => {
    const r = validateLine({ ...goodLine, amount: '10.129' });
    expect(r.ok && r.payload.amount).toBe(10.13);
  });

  it('rechaza importe vacio, texto, cero y negativo', () => {
    for (const amount of ['', 'abc', '0', '-5']) {
      const r = validateLine({ ...goodLine, amount });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.amount).toBeTruthy();
    }
  });

  it('rechaza IVA fuera de rango o no numerico', () => {
    for (const tax of ['-1', '101', 'x']) {
      const r = validateLine({ ...goodLine, tax });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.tax).toBeTruthy();
    }
  });

  it('IVA vacio equivale a 0; IVA decimal con coma vale', () => {
    const a = validateLine({ ...goodLine, tax: '' });
    expect(a.ok && a.payload.tax).toBe(0);
    const b = validateLine({ ...goodLine, tax: '10,5' });
    expect(b.ok && b.payload.tax).toBe(10.5);
  });

  it('fecha: vacia es null, invalida da error', () => {
    const a = validateLine({ ...goodLine, date: null });
    expect(a.ok && a.payload.date).toBeNull();
    const b = validateLine({ ...goodLine, date: '' });
    expect(b.ok && b.payload.date).toBeNull();
    const c = validateLine({ ...goodLine, date: '2025-02-30' });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors.date).toBeTruthy();
  });

  it('exige titulo (sin solo espacios), tipo de pago y categoria', () => {
    const r = validateLine({ ...goodLine, title: '   ', idPaymentType: '', idCategory: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['idCategory', 'idPaymentType', 'title']);
    }
  });

  it('recorta el titulo y la url de la foto', () => {
    const r = validateLine({ ...goodLine, title: '  Taxi ', foto: '  https://x/y.jpg ' });
    expect(r.ok && r.payload.title).toBe('Taxi');
    expect(r.ok && r.payload.foto).toBe('https://x/y.jpg');
  });

  it('foto vacia queda undefined', () => {
    const r = validateLine({ ...goodLine, foto: '   ' });
    expect(r.ok && r.payload.foto).toBeUndefined();
  });

  it('acumula todos los errores a la vez', () => {
    const r = validateLine({
      title: '', amount: '', tax: 'x', date: 'mal', idPaymentType: '', idCategory: '', idSheet: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toHaveLength(6);
  });
});

describe('validateSheet', () => {
  const good = {
    title: ' Viaje Madrid ',
    description: ' reunion ',
    project: ' Alfa ',
    approvalDate: '',
    idUser: 'emp-1',
    idStatus: '1',
  };

  it('acepta y normaliza; fecha vacia -> null', () => {
    const r = validateSheet(good);
    expect(r).toEqual({
      ok: true,
      payload: {
        title: 'Viaje Madrid',
        description: 'reunion',
        project: 'Alfa',
        approval_date: null,
        id_user: 'emp-1',
        id_status: '1',
      },
    });
  });

  it('rechaza titulo y proyecto vacios', () => {
    const r = validateSheet({ ...good, title: ' ', project: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['project', 'title']);
  });

  it('rechaza falta de empleado o estado', () => {
    expect(validateSheet({ ...good, idUser: undefined }).ok).toBe(false);
    expect(validateSheet({ ...good, idUser: '' }).ok).toBe(false);
    expect(validateSheet({ ...good, idStatus: '' }).ok).toBe(false);
  });

  it('rechaza fecha de aprobacion invalida', () => {
    expect(validateSheet({ ...good, approvalDate: '2025-99-99' }).ok).toBe(false);
  });
});
