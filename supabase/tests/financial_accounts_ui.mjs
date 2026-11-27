// Valida formatação e soma exata de centavos nos três clientes com TypeScript instalado no web.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../Domus_FrontEnd/domus-frontend/package.json', import.meta.url));
const ts = require('typescript');
for (const path of ['../../Domus_FrontEnd/domus-frontend/src/service/financialAccountService.ts', '../../Domus_FrontEnd_Exe/domus-frontend/src/service/financialAccountService.ts', '../../Domus_Mobile/services/financialAccountService.ts']) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8')).replace('import { supabase } from "../lib/supabase";', 'const supabase = {};');
  const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const { normalizeMoney, balanceTotal } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  assert.equal(normalizeMoney('1250,50'), '1250.50');
  assert.equal(normalizeMoney('-10.01'), '-10.01');
  assert.equal(normalizeMoney('1.234'), null);
  assert.equal(normalizeMoney(''), null);
  assert.equal(balanceTotal([{balance:'0.10'}, {balance:'0.20'}, {balance:'-0.01'}]), 0.29);
  assert.equal(balanceTotal([{balance:'invalido'}]), null);
}
console.log('OK: valores e soma em centavos nos três clientes');
