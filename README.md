# Agente de Clean Code para o Claude Code

Subagente do [Claude Code](https://docs.anthropic.com/en/docs/claude-code/sub-agents) que audita a qualidade de um
código e devolve um relatório com **nota de 0 a 10**, **achados priorizados** (arquivo:linha, regra violada, por que
importa e como corrigir, com antes e depois) e o **resultado real dos linters, type checkers e testes** do projeto.

Trabalho acadêmico do curso de Engenharia de Software da UniCesumar. O documento completo do trabalho está em [`docs/Agente-Clean-Code.pdf`](docs/Agente-Clean-Code.pdf).

## O que ele verifica

| Área | Fontes |
|---|---|
| Nomes, funções, comentários, formatação, objetos e erros | Clean Code (Martin, 2009) |
| SOLID e Clean Architecture | Martin (2017) |
| Object Calisthenics | Jeff Bay (2008) |
| DRY, KISS, YAGNI, Lei de Demeter, composição, imutabilidade | Hunt e Thomas; princípios gerais |
| 19 code smells selecionados, com a refatoração indicada | Fowler, *Refatoração* (1ª e 2ª ed.) |
| Design Patterns (uso real e padrão forçado) | Gamma et al. (GoF) |
| Segurança | OWASP Top 10 |
| Testes | F.I.R.S.T., AAA, cobertura |
| Regras da linguagem | TypeScript estrito, hooks e acessibilidade do React, async, PEP 8 |

Antes da leitura manual, ele roda as ferramentas que o projeto já tem configuradas, **só em modo de verificação**:
ESLint, Biome, Prettier, `tsc`, Vitest/Jest, knip, madge, jscpd, Ruff, mypy, pytest, Checkstyle, PMD, golangci-lint,
clippy, RuboCop, PHPStan, gitleaks, Semgrep, entre outras (tabela completa no
[arquivo do agente](.claude/agents/clean-code.md)).

## Como instalar

1. Copie [`.claude/agents/clean-code.md`](.claude/agents/clean-code.md) para a pasta `.claude/agents/` do seu
   repositório (ou para `~/.claude/agents/`, para usar em todos os projetos).
2. Abra o Claude Code na raiz do repositório. Se o agente não aparecer, rode `/agents` ou reinicie o Claude Code.

## Como usar

```text
use o agente clean-code para auditar src/domains/auth
use o agente clean-code no diff atual
use o agente clean-code na branch feature/login contra develop
use o agente clean-code no PR 17
```

O Claude Code também aciona o agente sozinho quando você pede uma revisão de qualidade ("esse código está limpo?").

## Severidade e nota

| Severidade | Quando | Desconto |
|---|---|---|
| 🔴 Crítico | Bug, falha de segurança, perda de dado, lint/teste/build falhando | −1,5 |
| 🟠 Alto | Violação de SOLID ou da arquitetura com custo alto, duplicação relevante, regra de negócio sem teste | −0,75 |
| 🟡 Médio | Code smell claro, nome ruim em código central, erro mal tratado | −0,25 |
| 🔵 Baixo | Legibilidade, comentário, formatação | −0,1 |

A nota parte de 10. Lint, type check ou testes falhando limitam a nota a 6,0. A conta aparece no relatório.

## Princípios do agente

- **Só lê e mede:** não edita arquivos, não faz commit e não roda `--fix`/`--write`.
- **Convenção do projeto vence preferência geral:** lê `CLAUDE.md`, regras, ADRs e configs de lint antes de julgar.
- **Sem evidência, não é achado:** todo achado traz `arquivo:linha` e um trecho real.
- **Honestidade nos dois sentidos:** não inventa problema para parecer rigoroso nem esconde problema para agradar.
- **Nunca diz que algo passou sem ter rodado.** Ferramenta ausente vira "não configurada".

## Resultados

### Casos de teste (gabarito escrito antes da execução)

O agente rodou nos três casos sem ler os arquivos `esperado.md`. Relatórios completos em
[`exemplos/resultados-casos-de-teste.md`](exemplos/resultados-casos-de-teste.md).

| Caso | Esperado | Obtido | Resultado |
|---|---|---|---|
| 01 · código limpo | Nota ≥ 9, nenhum achado Crítico/Alto/Médio | Nota 9,8, 2 achados Baixos | ✅ |
| 02 · nomes e função longa | 10 problemas, nota < 5 | 10 de 10 problemas, nota 5,7 | ⚠️ achados certos, nota acima do esperado |
| 03 · segurança e erros | 7 problemas, nota < 5 com ≥ 2 Críticos | 6 de 7 + 1 como pergunta, nota 2,4 com 4 Críticos | ✅ |

- **16 de 17** problemas do gabarito viraram achado; o 17º (hard delete) veio como pergunta, porque depende da
  convenção do projeto.
- **Nenhum falso positivo** na conferência.
- **Além do gabarito**, o agente reproduziu um bug real no caso 02: um valor `'100'` em string gera **9860** em vez de
  110 por coerção de tipos.
- **Onde errou:** classifica a gravidade para baixo. No caso 02 não marcou nada como Crítico (nota 5,7, acima do limite
  de 5 previsto) e, no código real, deu Médio a um bug (M2) que pela própria tabela de severidade seria Crítico.
- **Precisão 100%** (nenhum falso positivo) e **revocação 94%** (16 de 17). Execução de 13/11/2026 com o Claude Code
  2.1.323 e o Claude Opus 5.5; o registro da execução confirma que o agente não abriu os `esperado.md`.

### Código real: módulo de autenticação de uma API

Relatório completo em [`exemplos/relatorio-modulo-auth.md`](exemplos/relatorio-modulo-auth.md).

- 9 arquivos e 1.829 linhas, em cerca de 5 minutos.
- O agente rodou ESLint, Prettier, `tsc` e Vitest (54 testes) e mediu a cobertura (99,1% das linhas do service).
- **Nota 8,5/10**, com 3 achados médios e 8 baixos.
- Os 3 médios foram conferidos à mão e procedem (os 8 baixos foram lidos, mas não conferidos um a um). O principal: a renovação do refresh token revoga o token antigo e
  cria o novo fora de uma transação, o que pode derrubar todas as sessões do usuário numa falha do banco.


## Testes

```bash
npm test
```

São dois tipos de teste:

1. **Testes automáticos** ([`tests/agent.test.mjs`](tests/agent.test.mjs), `node:test`, sem dependências): conferem
   que o agente tem só ferramentas de leitura, que o prompt proíbe alterar o repositório, cobre todas as fontes
   prometidas, lista os linters, define severidade e pesos da nota, tem todas as seções do relatório, exige evidência,
   e que cada caso de teste tem código e gabarito. Rodam no GitHub Actions a cada push.
2. **Casos de teste do comportamento** ([`casos-de-teste/`](casos-de-teste/)): cada pasta tem um código e um
   `esperado.md` escrito **antes** de rodar o agente. Para avaliar, rode o agente no código sem deixá-lo ler o
   `esperado.md` e compare.

## Estrutura

```text
.claude/agents/clean-code.md      o agente
casos-de-teste/                   código + gabarito (esperado.md) de cada caso
exemplos/                         relatórios reais gerados pelo agente
tests/agent.test.mjs              testes automáticos do arquivo do agente
docs/Agente-Clean-Code.pdf        documento do trabalho (ABNT)
.github/workflows/test.yml        CI
```

## Limitações

- O agente usa um modelo de linguagem e **não é determinístico**: rodando de novo no mesmo código, a nota e os achados
  podem variar um pouco. A parte das ferramentas (lint, tipos, testes) é determinística.
- Ainda não medimos precisão e revocação com uma amostra grande; os casos de teste são poucos e foram escritos pela
  mesma equipe que escreveu o agente.
- A auditoria leva alguns minutos e consome créditos do modelo: ela complementa o lint no CI e a revisão humana, não
  os substitui.

## Equipe

Gabriel Nascimento · Lucas Lima · Daniel Andrade · Felipe Duarte · Felipe Broetto · Lucca Rocha

## Licença

[MIT](LICENSE)
