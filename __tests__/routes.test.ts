import * as fs from 'fs';
import * as path from 'path';

// expo-router convierte TODO fichero de app/ en una ruta publica. Aqui solo
// debe haber pantallas y layouts; los contextos/hooks viven en context/.
const APP_DIR = path.join(__dirname, '..', 'app');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

const files = walk(APP_DIR).map((f) => path.relative(APP_DIR, f));

describe('app/ solo contiene rutas', () => {
  it('no hay restos de Next.js (page.tsx, layout.tsx, globals.css)', () => {
    const banned = files.filter((f) => /(^|\/)(page|layout)\.tsx$|globals\.css$/.test(f));
    expect(banned).toEqual([]);
  });

  it('no hay carpetas context/ dentro de app/', () => {
    expect(files.filter((f) => f.split('/').includes('context'))).toEqual([]);
  });

  it('todos los ficheros son pantallas .tsx', () => {
    expect(files.filter((f) => !f.endsWith('.tsx'))).toEqual([]);
  });

  it('cada pantalla exporta un componente por defecto', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(APP_DIR, f), 'utf8');
      expect({ f, hasDefault: /export default/.test(src) }).toEqual({ f, hasDefault: true });
    }
  });
});
