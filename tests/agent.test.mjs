import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_PATH = '.claude/agents/clean-code.md';
const CASES_DIR = 'casos-de-teste';
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];

const agent = readFileSync(AGENT_PATH, 'utf8');

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, 'o arquivo precisa começar com um frontmatter entre ---');
  const entries = match[1].split('\n').map((line) => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });
  return Object.fromEntries(entries);
}

const frontmatter = parseFrontmatter(agent);
const body = agent.slice(agent.indexOf('\n---\n', 4) + 5);

test('o frontmatter tem nome, descrição, ferramentas e modelo', () => {
  assert.equal(frontmatter.name, 'clean-code');
  assert.ok(frontmatter.description.length > 100, 'a descrição precisa dizer quando usar o agente');
  assert.ok(frontmatter.tools, 'as ferramentas precisam ser declaradas');
  assert.ok(frontmatter.model, 'o modelo precisa ser declarado');
});

test('o agente só tem ferramentas de leitura', () => {
  const tools = frontmatter.tools.split(',').map((tool) => tool.trim());
  assert.deepEqual([...tools].sort(), [...READ_ONLY_TOOLS].sort());
  for (const tool of WRITE_TOOLS) {
    assert.ok(!tools.includes(tool), `${tool} daria ao agente permissão de editar arquivos`);
  }
});

test('o prompt proíbe alterar o repositório', () => {
  assert.match(body, /só lê e mede/i);
  for (const forbidden of ['--fix', '--write', 'commit']) {
    assert.ok(body.includes(forbidden), `o prompt precisa proibir ${forbidden}`);
  }
});

test('o prompt cobre todas as fontes de padrão prometidas', () => {
  const required = [
    'Clean Code', 'SOLID', 'Object Calisthenics', 'DRY', 'KISS', 'YAGNI', 'Demeter',
    'Fowler', 'GoF', 'Clean', 'OWASP', 'F.I.R.S.T.', 'AAA',
  ];
  for (const topic of required) {
    assert.ok(body.includes(topic), `falta ${topic} no checklist`);
  }
});

test('o prompt lista linters de várias linguagens', () => {
  const linters = ['ESLint', 'Prettier', 'tsc', 'Ruff', 'mypy', 'Checkstyle', 'golangci-lint', 'clippy', 'RuboCop', 'gitleaks'];
  for (const linter of linters) {
    assert.ok(body.includes(linter), `falta ${linter} na tabela de ferramentas`);
  }
});

test('a severidade e a nota estão definidas com os pesos', () => {
  for (const level of ['Crítico', 'Alto', 'Médio', 'Baixo']) {
    assert.ok(body.includes(level), `falta a severidade ${level}`);
  }
  for (const weight of ['−1,5', '−0,75', '−0,25', '−0,1', 'teto de 6,0']) {
    assert.ok(body.includes(weight), `falta o peso ${weight}`);
  }
});

test('o formato do relatório tem todas as seções', () => {
  const sections = ['## Resumo', '## Ferramentas', '## Achados', '## Pontos fortes', '## Plano de ação', '## Métricas'];
  for (const section of sections) {
    assert.ok(body.includes(section), `falta a seção ${section} no modelo de relatório`);
  }
  for (const field of ['**Onde:**', '**Regra:**', '**Problema:**', '**Por que importa:**', '**Como corrigir:**']) {
    assert.ok(body.includes(field), `falta o campo ${field} no modelo de achado`);
  }
});

test('o prompt exige evidência e honestidade', () => {
  assert.match(body, /arquivo:linha/);
  assert.match(body, /Sem evidência, não é achado/);
  assert.match(body, /não invente problema/i);
});

test('cada caso de teste tem código e gabarito', () => {
  const cases = readdirSync(CASES_DIR);
  assert.ok(cases.length >= 3, 'são esperados pelo menos 3 casos de teste');
  for (const name of cases) {
    const files = readdirSync(join(CASES_DIR, name));
    assert.ok(files.includes('esperado.md'), `${name} precisa do esperado.md`);
    assert.ok(files.some((file) => /\.(ts|tsx|js|py|java|go)$/.test(file)), `${name} precisa de um arquivo de código`);
  }
});

test('os relatórios reais do agente estão no repositório', () => {
  assert.ok(existsSync('exemplos/relatorio-cromocard-auth.md'));
  assert.ok(existsSync('exemplos/resultados-casos-de-teste.md'));
});
