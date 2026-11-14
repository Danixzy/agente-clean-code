# Resultados do agente nos casos de teste

Execução de 13/11/2026. O agente `clean-code` auditou os três casos de [`casos-de-teste/`](../casos-de-teste/) de forma
independente, **sem ler os arquivos `esperado.md`** (o gabarito, escrito antes da execução). Não há lint nem testes
configurados em volta dos casos, então a revisão foi só manual. Os relatórios abaixo estão como o agente devolveu.

## Comparação com o gabarito

| Caso | Esperado | Obtido | Resultado |
|---|---|---|---|
| 01 · código limpo | Nota ≥ 9 e nenhum achado Crítico, Alto ou Médio | Nota 9,8 · 2 achados Baixos · pontos fortes reconhecidos | ✅ |
| 02 · nomes e função longa | 10 problemas listados · nota abaixo de 5 | 10 de 10 problemas encontrados · nota **5,7** | ⚠️ achados certos, nota acima do esperado |
| 03 · segurança e erros | 7 problemas · nota abaixo de 5 com ao menos 2 Críticos | 6 de 7 como achado + o hard delete levantado como pergunta · nota 2,4 com 4 Críticos | ✅ |

- **Problemas do gabarito encontrados:** 16 de 17 como achado pontuado. O 17º (hard delete no caso 03) apareceu como
  pergunta sem desconto, porque depende da convenção do projeto, o que o próprio gabarito reconhece.
- **Falsos positivos:** nenhum achado foi considerado inválido na conferência.
- **Achados além do gabarito:** no caso 02, o agente reproduziu um bug real (um valor `'100'` em string gera **9860**
  em vez de 110 por coerção de tipos) e apontou dinheiro em ponto flutuante. No caso 01, levantou que `Math.round`
  mostra 100% com 199 de 200 cartas.
- **Divergências de severidade:** no caso 03, o `catch` vazio e a promessa solta vieram como Críticos (o gabarito
  previa Altos). No caso 02, o agente não marcou nada como Crítico, e por isso a nota ficou em 5,7, acima do
  limite de 5 previsto.

---

# Caso 01

# Relatório de Clean Code: `caso-01-codigo-limpo/album.service.ts`

**Nota: 9,8/10 (Excelente)** · Escopo: `casos-de-teste/caso-01-codigo-limpo/album.service.ts` (arquivo inteiro, 30 linhas) · Stack: TypeScript (sem framework)

## Resumo
O código está limpo:
- os nomes revelam a intenção;
- a função é curta, com guard clauses e um único nível de abstração;
- a dependência é injetada por uma abstração (DIP);
- o erro é específico do domínio;
- os campos são `readonly` e o número mágico virou constante.

Achei só dois pontos menores: a classe de erro não define `name` e o arquivo não tem ferramentas de verificação. Deixo duas perguntas de regra de negócio sobre o arredondamento e o limite de 100%, sem desconto na nota.

## Ferramentas
| Ferramenta | Comando | Resultado |
|---|---|---|
| ESLint / Biome | — | não configurada |
| Prettier | — | não configurada |
| tsc | — | não configurada (sem tsconfig) |
| Vitest / Jest | — | não configurada |
| jscpd / knip / madge | — | não configurada |

## Achados

### 🔵 B1: `AlbumNotFoundError` não define `name` nem guarda o `albumId`
- **Onde:** `album.service.ts:11-15`
- **Regra:** Clean Code cap. 7, erros com contexto
- **Problema:** a subclasse de `Error` não define `this.name`, então logs e stack traces mostram `Error: Álbum X não encontrado` em vez de `AlbumNotFoundError`. O `albumId` só existe dentro da mensagem.
- **Por que importa:** um handler HTTP ou um log estruturado precisaria fazer parse da mensagem para recuperar o id. Com o nome certo, a triagem nos logs fica imediata.
- **Como corrigir:**
  ```ts
  export class AlbumNotFoundError extends Error {
    override readonly name = 'AlbumNotFoundError';
    constructor(readonly albumId: string) {
      super(`Álbum ${albumId} não encontrado`);
    }
  }
  ```

### 🔵 B2: Nenhuma ferramenta de verificação nem teste configurado
- **Onde:** pasta `caso-01-codigo-limpo/`
- **Regra:** seção 2 do processo de auditoria; Clean Code cap. 9 (testes)
- **Problema:** nada garante `strict`, formatação nem o comportamento de `progressOf`, que tem três caminhos.
- **Como corrigir:** configure `tsc` com `strict`, ESLint com `typescript-eslint`, Prettier e um teste de unidade com um fake do `AlbumRepository` para cada caminho.

### Perguntas (sem desconto na nota)
1. **Arredondamento para 100% com álbum incompleto** (`album.service.ts:28`). `Math.round` faz 199/200 = 99,5 virar `100`. Se a UI usa 100% para dizer "álbum completo", o usuário verá completo quando falta uma carta. Se não for intencional, use `Math.floor`.
2. **Progresso acima de 100%** (`album.service.ts:27-28`). Se `countOwnedCards` contar repetidas, o resultado passa de 100. Limite com `Math.min(..., FULL_PERCENTAGE)` ou deixe o contrato explícito.

## Pontos fortes
- **DIP e testabilidade:** o serviço depende de uma interface (linha 20).
- **Guard clauses e early return** (linhas 24-25), aninhamento de 1 nível; a divisão por zero foi tratada antes.
- **Imutabilidade:** `readonly` nos campos e na dependência.
- **Sem número mágico:** `FULL_PERCENTAGE = 100`.
- **Erro de domínio** em vez de `null`; **ISP** e **SRP**; tipos de retorno explícitos.

## Métricas
| Métrica | Valor |
|---|---|
| Maior função | `progressOf`: 8 linhas |
| Complexidade ciclomática | 3 (cognitiva 2) |
| Aninhamento máximo | 1 |

**Conta da nota:** 10 − 0,1 (B1) − 0,1 (B2) = **9,8**.

---

# Caso 02

# Relatório de Clean Code: `caso-02-nomes-e-funcao-longa/trade.ts`

**Nota: 5,7/10 (Regular)** · Escopo: `casos-de-teste/caso-02-nomes-e-funcao-longa/trade.ts` (arquivo inteiro, 32 linhas) · Stack: TypeScript (sem framework)

## Resumo
Uma função pública, `proc`, calcula um valor de negociação, mas nada no código diz isso. O que mais pesa:
1. Nenhum nome revela a intenção (`proc`, `d`, `u`, `t`, `x`, `y`, `r`, `st`, `v`).
2. A função faz quatro coisas, com 5 níveis de aninhamento e complexidade cognitiva perto de 22.
3. Com `any`, `==` e nenhuma validação, uma entrada um pouco diferente gera resultados absurdos, que reproduzi: 9860 em vez de 110, ou um `TypeError`.

## Achados

### 🟠 A1: Nomes que não revelam a intenção em toda a API pública
- **Onde:** `trade.ts:1` (`proc`, `d`, `u`, `flag`, `t`, `x`, `y`), `:2` (`r`), `:6/:12` (`st`), `:8/:10/:13` (`v`)
- **Regra:** Clean Code cap. 2 · Object Calisthenics 6 (não abreviar)
- **Como corrigir:** Rename Function/Variable, por exemplo `calculateTradeTotal(trade: Trade, user: User, options: PricingOptions)`.

### 🟠 A2: Long Method: quatro responsabilidades e aninhamento de 5 níveis
- **Onde:** `trade.ts:1-32`, pior trecho em `:3-17`
- **Regra:** Clean Code cap. 3 (uma coisa, Stepdown Rule) · complexidade cognitiva ≤ 15 · Object Calisthenics 1 e 2 · Smell: Long Method
- **Problema:** soma os itens por status (3-17), soma a taxa (19), aplica desconto por volume (20-22) e multiplicador por papel (23-29). Ciclomática 10, cognitiva perto de 22.
- **Como corrigir:** Extract Function em `sumItems`, `applyVolumeDiscount` e `applyRoleMultiplier`, com guard clauses.

### 🟠 A3: `any`, `==` e falta de validação produzem resultados errados e quebras
- **Onde:** `trade.ts:1`, `:6`, `:12`, `:23`, `:26`
- **Regra:** TypeScript estrito · `eqeqeq` · validação na borda
- **Problema:** com `v: '100'` em string, `t = 10` e cliente, o resultado é **9860** em vez de 110 (`0 + '100'` concatena). Com `u` indefinido, `TypeError`. `st: '1'` é aceito em silêncio.
- **Como corrigir:** tipos explícitos, `===` e validação (zod ou type guard) antes da regra.

### 🟠 A4: Valor monetário calculado em ponto flutuante, sem arredondamento
- **Onde:** `trade.ts:8`, `:13`, `:24`, `:31`
- **Problema:** um item de 19,90 com desconto, taxa 0,1 e vendedor dá `18.910500000000003`.
- **Como corrigir:** calcular em centavos inteiros e arredondar uma vez, no fim.

### 🟡 M1: Números e strings mágicos — `1`, `2`, `0.9`, `0.5`, `5000`, `150`, `1.05`, `'SELLER'`, `'CUSTOMER'`
### 🟡 M2: Flag argument `flag` (`trade.ts:1`, `:7-11`)
### 🟡 M3: Long Parameter List com parâmetros mortos `x` e `y` (`trade.ts:1`)
### 🟡 M4: Condicional por tipo de usuário com branch morto — `r = r * 1.0` (`trade.ts:23-29`); sugere mapa `ROLE_MULTIPLIER`
### 🔵 B1: Comentário redundante (`// soma a taxa`) e código comentado (`// console.log(r)`)
### 🔵 B2: Acumulador mutável e loop indexado (`let r` reatribuído 7 vezes)
### 🔵 B3: Nenhuma ferramenta de verificação nem teste configurado

### Perguntas (sem desconto na nota)
1. A taxa entrar antes do teste de 5000 e o multiplicador depois do desconto é intencional?
2. Itens com status diferente de 1 e 2 são ignorados de propósito?
3. Qual o significado de negócio dos status 1 e 2 e de `flag`?

## Pontos fortes
- Função pura (sem I/O, sem alterar argumentos), o que facilita testes de caracterização antes de refatorar.
- `d` e `d.items` ausentes têm proteção.

## Métricas
| Métrica | Valor |
|---|---|
| Maior função | `proc`: 32 linhas |
| Complexidade ciclomática | 10 (cognitiva perto de 22) |
| Aninhamento máximo | 5 |
| Parâmetros | 6 (2 sem uso) |

**Conta da nota:** 10 − 4 × 0,75 − 4 × 0,25 − 3 × 0,1 = **5,7**.

---

# Caso 03

# Relatório de Clean Code: `caso-03-seguranca-e-erros/users.repository.ts`

**Nota: 2,4/10 (Precisa de refatoração)** · Escopo: `casos-de-teste/caso-03-seguranca-e-erros/users.repository.ts` (15 linhas) · Stack: TypeScript + `pg`

## Resumo
Em 15 linhas há quatro problemas críticos: SQL injection, senha do banco no código, `catch` vazio que transforma qualquer falha em "usuário não encontrado" e promise solta em `deleteUser`. Além disso, dados pessoais no log, `SELECT *`, sem tipos de retorno e pool criado no carregamento do módulo.

## Achados

### 🔴 C1: SQL injection por interpolação da entrada na query
- **Onde:** `users.repository.ts:7` — `` pool.query(`SELECT * FROM users WHERE email = '${email}'`) ``
- **Regra:** OWASP Top 10 A03:2021 (Injection)
- **Como corrigir:** `pool.query('SELECT id, email, name FROM users WHERE email = $1', [email])`, como a linha 14 já faz.

### 🔴 C2: Credencial do banco escrita no código
- **Onde:** `users.repository.ts:3`
- **Como corrigir:** ler `process.env.DATABASE_URL`, falhar cedo se faltar e **trocar a senha**, que deve ser considerada comprometida.

### 🔴 C3: `catch` vazio engole qualquer erro e o confunde com "não encontrado"
- **Onde:** `users.repository.ts:6-10`
- **Regra:** Clean Code cap. 7
- **Por que importa:** uma pane do banco vira "e-mail não cadastrado" e o incidente some dos logs.

### 🔴 C4: Promise solta em `deleteUser`
- **Onde:** `users.repository.ts:14`
- **Por que importa:** a função resolve antes do DELETE terminar; uma rejeição sem tratamento encerra o processo no Node 15+.

### 🟠 A1: Dados pessoais gravados no log (`users.repository.ts:8`) — OWASP A09 · LGPD
### 🟡 M1: `SELECT *` (`users.repository.ts:7`)
### 🟡 M2: API pública sem tipos de retorno (`users.repository.ts:5`, `:13`)
### 🟡 M3: Pool global criado no carregamento do módulo (DIP) (`users.repository.ts:1-3`)
### 🔵 B1: Nenhuma ferramenta de verificação nem teste configurado

### Perguntas (sem desconto na nota)
1. Remoção física (`DELETE`) é a regra, ou o projeto usa soft delete?
2. `deleteUser` deveria sinalizar quando o `id` não existe?

## Pontos fortes
- `deleteUser` já usa query parametrizada, modelo para corrigir a linha 7.
- Nomes claros e arquivo coeso (SRP no nível do módulo).

**Conta da nota:** 10 − 4 × 1,5 − 0,75 − 3 × 0,25 − 0,1 = **2,4**.
