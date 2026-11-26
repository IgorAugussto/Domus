// Usa o TypeScript já instalado no projeto web para testar os três clientes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../Domus_FrontEnd/domus-frontend/package.json', import.meta.url));
const ts = require('typescript');
for (const path of [
  '../../Domus_FrontEnd/domus-frontend/src/utils/installments.ts',
  '../../Domus_FrontEnd_Exe/domus-frontend/src/utils/installments.ts',
  '../../Domus_Mobile/utils/installments.ts',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const { splitInstallmentTotal } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  assert.deepEqual(splitInstallmentTotal('100', 3), { total: 100, first: 33.34, last: 33.33, remainder: 1 });
  assert.deepEqual(splitInstallmentTotal('1200.00', 6), { total: 1200, first: 200, last: 200, remainder: 0 });
  assert.equal(splitInstallmentTotal('0.02', 3), null);
  assert.equal(splitInstallmentTotal('100.001', 3), null);
  assert.equal(splitInstallmentTotal('100', 2.5), null);
}
console.log('OK: divisão em centavos e validação nos três clientes');
