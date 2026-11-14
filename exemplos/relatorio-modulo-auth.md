# Relatório de Clean Code: `src/domains/auth`

> Relatório gerado pelo agente `clean-code` em 13/11/2026 (Claude Code 2.1.323, Claude Opus 5.5), no módulo de
> autenticação de uma API real em Node.js/TypeScript, na branch `develop`. Reproduzido sem edição de conteúdo, exceto
> pela remoção do nome do projeto nos caminhos.
> Os três achados médios (M1, M2 e M3) foram conferidos à mão no código e procedem.

**Nota: 8,5/10 (Bom)** · Escopo: os 9 arquivos de `src/domains/auth/` na branch `develop` do submódulo, 1.829 linhas (873 de código de produção + 130 de Swagger + 826 de teste). O `.gitkeep` vazio ficou de fora. · Stack: Node 24, TypeScript strict, Express 5, Prisma/PostgreSQL, Zod 4 e Vitest.

## Resumo
O domínio está bem feito. Lint, tipos, formatação e os 54 testes unitários passam, a `AuthService` tem 99% das linhas cobertas e não há falha de segurança concreta. O que mais pesa:
1. A `AuthService` acumula sessão, cadastro, confirmação de e-mail, recuperação de senha, Google e limpeza num arquivo de 406 linhas.
2. A rotação do refresh token não roda numa transação: se a criação do token novo falhar, o sistema pode registrar um falso "reuso" e encerrar todas as sessões do usuário.
3. A regra "confirmar o e-mail" acontece de forma implícita: `changePassword` também marca o e-mail como verificado, e há um estado montado à mão (`{ ...existing, emailVerified: true }`) só para aproveitar uma validação.

Pontos fortes: dependências injetadas por portas (DIP), defesa contra enumeração de contas e contra timing, detecção de reuso do refresh, tokens guardados só como hash, e testes com fakes em memória ligados aos critérios de aceite (CA).

## Ferramentas
| Ferramenta | Comando | Resultado |
|---|---|---|
| ESLint (type-checked, `max-depth` 1, `max-params` 3, `max-lines-per-function` 25) | `npx --no-install eslint src/domains/auth` | ✅ 0 erros · 0 avisos |
| Prettier | `npx --no-install prettier --check src/domains/auth` | ✅ todos os arquivos formatados |
| tsc | `npm run typecheck` (projeto inteiro) | ✅ 0 erros |
| Vitest (unitários) | `npx --no-install vitest run src/domains/auth --coverage …` (relatório no scratchpad, sem tocar no repo) | ✅ 2 arquivos, 54 testes passando, 5,4 s |
| Cobertura (v8) | idem, filtrada para `src/domains/auth/**` | `auth.service.ts`: 99,1% das linhas e 95,3% dos branches (só a linha 149 fica sem cobertura). Controller, repository, routes e swagger ficam em 0% nos unitários, porque pelo ADR-008/060 eles são cobertos pelos testes de integração |
| Testes de integração | `npm run test:integration` | não rodado: o PostgreSQL local não respondeu (`pg_isready`: "no response"). Existem `tests/integration/auth.spec.ts`, `auth-register.spec.ts`, `auth-password.spec.ts` e `cleanup-expired-tokens.spec.ts` |
| Complexidade | ESLint com `complexity` temporário, só via `--rule` na linha de comando (o config não foi alterado) | maior valor: 6 (`AuthService.refresh`) |
| npm audit | `npm audit --omit=dev` | 1 moderada (`fast-uri`, transitiva). Nada nas dependências de auth (argon2, jsonwebtoken, google-auth-library, cookie-parser, express-rate-limit) |
| jscpd | — | não instalado (o `npx --no-install` recusou); duplicação não medida |

## Achados

### 🟡 M1: `AuthService` com vários motivos para mudar
- **Onde:** `src/domains/auth/auth.service.ts:1-406` (classe em 152-406)
- **Regra:** SRP (SOLID) · Clean Code cap. 10 (classes pequenas) · Smells: Large Class, Divergent Change · Object Calisthenics 7 (entidades pequenas)
- **Problema:** uma só classe cuida de quatro fluxos independentes. São eles: sessão (`login`, `loginWithGoogle`, `refresh`, `logout`, `startSession`), cadastro e confirmação (`register`, `verifyEmail`, `resendVerification`), recuperação de senha (`forgotPassword`, `resetPassword`, `issuePasswordReset`) e limpeza (`deleteExpiredTokens`). O arquivo tem 406 linhas, acima do alerta de ~300, e o `AuthServiceDeps` tem 8 dependências, das quais cada fluxo usa só uma parte.
- **Por que importa:** qualquer mudança no e-mail de confirmação, na política de sessão ou no reset de senha mexe no mesmo arquivo e no mesmo spec de 770 linhas. Com as próximas features (troca de senha no perfil, reativação de conta), o arquivo continua crescendo.
- **Como corrigir:** Extract Class por fluxo, mantendo as portas que já existem. Cada classe recebe só o que usa, e o `auth.module.ts` monta as três.
  ```ts
  // depois
  export class SessionService { login(); loginWithGoogle(); refresh(); logout(); deleteExpiredTokens(); }
  export class AccountRegistrationService { register(); verifyEmail(); resendVerification(); }
  export class PasswordResetService { forgotPassword(); resetPassword(); }
  ```

### 🟡 M2: rotação do refresh token fora de transação
- **Onde:** `auth.service.ts:322-325` (revoga) e `auth.service.ts:390-396` (cria o novo token); `auth.repository.ts:34` (`revokeRefreshToken` não aceita `tx`)
- **Regra:** Clean Code cap. 7 (tratamento de erro) · consistência transacional · Principle of Least Astonishment
- **Problema:**
  ```ts
  const revokedNow = await this.deps.authRepository.revokeRefreshToken(stored.id);
  if (!revokedNow) return this.rejectReusedToken(stored);
  return this.startSession(account, stored.expiresAt, context); // createRefreshToken separado
  ```
  Se o `createRefreshToken` falhar (queda do banco, timeout), o token antigo já está revogado. Quando o front tenta de novo com o mesmo cookie, cai em `rejectReusedToken`, que revoga **todas** as sessões e loga "Refresh token reutilizado".
- **Por que importa:** uma falha de infraestrutura passa a ser registrada como evento de segurança falso e derruba o usuário em todos os dispositivos. O `runInTransaction` já está injetado e o `resetPassword` usa esse padrão (linha 236).
- **Como corrigir:** fazer o par revogar + criar dentro de `runInTransaction`, passando `tx` para `revokeRefreshToken` e `createRefreshToken`, como já é feito com `markPasswordResetTokenUsed`.
  ```ts
  return this.deps.runInTransaction(async (tx) => {
    const revokedNow = await authRepository.revokeRefreshToken(stored.id, tx);
    if (!revokedNow) throw new RefreshTokenReusedError(); // revogação geral fora da tx
    return this.startSession(account, stored.expiresAt, context, tx);
  });
  ```
  O `startSession` passaria a ter 4 parâmetros. Para respeitar `max-params` 3, junte `refreshExpiresAt` e `context` num objeto (Introduce Parameter Object).

### 🟡 M3: confirmação de e-mail implícita (efeito colateral escondido e estado montado à mão)
- **Onde:** `auth.service.ts:74` e `:281` (`users.changePassword`), que dependem de `src/domains/users/users.repository.ts:242`; `auth.service.ts:367`
- **Regra:** Clean Code cap. 3 ("Have No Side Effects") · Principle of Least Astonishment · Smell: Comments as deodorant (aqui o nome do teste explica o que o código não diz)
- **Problema:**
  - `changePassword` também grava `emailVerified: true` (`data: { passwordHash, emailVerified: true }`). A porta `AuthUsers.changePassword` não deixa isso visível. A regra de negócio "redefinir a senha pelo link confirma o e-mail" fica dentro do repository de outro domínio, e só o nome do teste ("CA5: … confirma o e-mail") a revela.
  - Em `findOrLinkGoogleAccount`, `assertCanSignIn({ ...existing, emailVerified: true })` monta um estado falso só para pular a terceira checagem da guarda.
- **Por que importa:** quem ler `resetPassword` não descobre que o e-mail passa a ser verificado. Se alguém reaproveitar `changePassword` na troca de senha do perfil, vai herdar a regra sem perceber. Montar o objeto à mão também acopla o chamador à ordem interna das checagens de `assertCanSignIn`.
- **Como corrigir:** deixar a regra explícita nos dois pontos.
  ```ts
  // antes
  assertCanSignIn({ ...existing, emailVerified: true });
  // depois
  function assertAccountUsable(account: AccountCredentials): void {
    if (account.deletedAt) throw new AccountDeletedError();
    if (account.status !== 'ACTIVE') throw new AccountSuspendedError();
  }
  function assertCanSignIn(account: AccountCredentials): void {
    assertAccountUsable(account);
    if (!account.emailVerified) throw new EmailNotVerifiedError();
  }
  ```
  Para a senha, renomeie a porta para `resetPassword(id, hash, tx)` (ou `changePasswordAndVerifyEmail`), ou chame `markEmailVerified(id, tx)` na própria transação do `replacePassword`.

### 🔵 B1: ordem dos membros fora da Stepdown Rule
- **Onde:** `auth.service.ts:99` (`AuthLogger` declarado depois de ser usado na linha 96), `:104-105` (constantes de path entre interfaces), `:199` (`assertEmailAvailable`, privado, entre dois métodos públicos), `:293` (`loginWithGoogle`, público, depois dos helpers privados de reset)
- **Regra:** Clean Code cap. 5 (distância vertical, leitura de cima para baixo)
- **Problema / correção:** públicos e privados estão intercalados sem critério. Agrupe por fluxo, com cada método público seguido dos privados que ele chama, e junte as constantes no topo. Se o M1 for feito, isso se resolve sozinho.

### 🔵 B2: números mágicos e mensagens que repetem as constantes
- **Onde:** `auth.validator.ts:10` (`max(160…)`), `:41-42` (`min(2…)`, `max(120…)`), `:18-19` (mensagens "pelo menos 8" e "no máximo 128" escritas à mão, embora `PASSWORD_MIN_LENGTH` e `PASSWORD_MAX_LENGTH` existam), `auth.service.ts:55` (`role: 'CUSTOMER' | 'SELLER'` duplica o `z.enum` da linha 45 do validator)
- **Regra:** Clean Code cap. 17 (G25, Replace Magic Number with Constant) · DRY
- **Problema:** se alguém mudar `PASSWORD_MIN_LENGTH`, a mensagem continua dizendo 8. O tipo de papel do autocadastro existe em dois lugares.
- **Como corrigir:**
  ```ts
  .min(PASSWORD_MIN_LENGTH, { error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres` })
  export const SELF_SIGNUP_ROLES = ['CUSTOMER', 'SELLER'] as const; // usado no schema e em NewAccount
  ```

### 🔵 B3: limites de rate limit duplicados no Swagger e respostas 400 faltando
- **Onde:** `auth.routes.ts:8-11` comparado com `auth.swagger.ts:16, 77, 99, 111, 123`; `auth.swagger.ts:43-48` (`/google`) e `:97-100` (`/verify-email/resend`)
- **Regra:** DRY (duplicação de conhecimento) · ADR-006 (o Swagger documenta o contrato)
- **Problema:** os números (5/min, 10/h, 3/15 min, 10/15 min) estão escritos nos dois arquivos e podem divergir sem aviso. Além disso, `/google` e `/verify-email/resend` validam o corpo com Zod (e podem responder `400 VALIDATION_ERROR`), mas o Swagger não lista essa resposta.
- **Como corrigir:** exportar os objetos de limite das rotas (ou de um `auth.limits.ts`) e gerar o texto do 429 a partir deles. Incluir o `400` nas duas rotas.

### 🔵 B4: "lembrar de mim" calculado por heurística em `isPersistent`
- **Onde:** `auth.service.ts:380-383`
- **Regra:** Principle of Least Astonishment · Smell: Temporary Field / estado derivado
- **Problema:** a sessão é considerada persistente quando o tempo restante do refresh passa do TTL padrão. Numa sessão com "lembrar de mim", quando falta menos de 1 dia, o refresh seguinte devolve `persistent: false` e o cookie vira de sessão: some ao fechar o navegador, embora o token ainda valha. A heurística também deixa de funcionar se `REFRESH_TTL_REMEMBER <= REFRESH_TTL`.
- **Contexto:** a spec CCD004 (L14) decidiu não guardar uma coluna de "lembrar", então essa é uma consequência da decisão, não um erro de implementação. Vale confirmar com o time se a perda no último dia é aceitável. Se não for, a correção é uma coluna `persistent` em `refresh_tokens` (DER + ADR).

### 🔵 B5: primeiro login com Google sem tratar corrida de e-mail único
- **Onde:** `auth.service.ts:365` (`users.createGoogleAccount(profile)`)
- **Regra:** Clean Code cap. 7 · consistência com `register` (linhas 173-175, que usam `.catch(rejectDuplicateEmail)`)
- **Problema:** dois `POST /auth/google` simultâneos para um e-mail novo (duplo clique, duas abas) fazem um deles bater na constraint única e responder 500.
- **Como corrigir:** tratar o `isUniqueConstraintError` como no `register`, e nesse caso tentar de novo o `findCredentialsByGoogleId`.

### 🔵 B6: detalhes nos testes do service
- **Onde:** `auth.service.spec.ts:672`, `:637-640` e `:684-685`, `auth.service.ts:149`
- **Regra:** Clean Code cap. 9 (F.I.R.S.T., Repeatable) · DRY nos testes
- **Problema:**
  - `await new Promise((resolve) => setTimeout(resolve, 20))` usa uma espera fixa para uma asserção negativa. Numa máquina lenta de CI, o teste pode passar sem a tarefa em background ter terminado.
  - A extração do token do HTML (`/href="([^"]+)"/` + `new URL(...)`) aparece duplicada.
  - O caminho que relança um erro que não é de unicidade (linha 149) não tem teste.
- **Como corrigir:** expor o `runInBackground` por uma porta injetável (um scheduler falso nos testes) ou esperar com `vi.waitFor` uma condição observável, como uma consulta registrada no fake. Extrair um helper `tokenFromLastMail()`. Adicionar um caso em que `createWithPassword` rejeita com um erro genérico.

### 🔵 B7: nomes e cast no controller
- **Onde:** `auth.controller.ts:94` (`{ accessToken, user, ...refresh }`) e `:34` (`req.cookies as Record<string, string | undefined>`)
- **Regra:** Clean Code cap. 2 (nomes que revelam intenção) · TypeScript (sem `as` desnecessário)
- **Problema:** `refresh` é o resto do objeto (`refreshToken`, `refreshExpiresAt`, `persistent`) e se confunde com o método `refresh` da mesma classe. O cast em si se justifica, porque o `cookie-parser` tipa `cookies` como `any`, mas fica sem validação.
- **Como corrigir:** desestruturar os campos com nome próprio (`{ accessToken, user, refreshToken, refreshExpiresAt, persistent }`). Para o cookie, ler com `typeof value === 'string' ? value : undefined`.

### 🔵 B8: tipagem do repository e artefato sobrando
- **Onde:** `auth.repository.ts:74` (`replacePasswordResetToken` sem tipo de retorno explícito), `:43` (`refreshTokenSelect` sem `satisfies Prisma.RefreshTokenSelect`), `src/domains/auth/.gitkeep` (a pasta já está populada)
- **Regra:** TypeScript (tipo de retorno em API pública) · Boy Scout Rule
- **Como corrigir:** `async replacePasswordResetToken(...): Promise<void>`, `const refreshTokenSelect = {...} satisfies Prisma.RefreshTokenSelect;` e remover o `.gitkeep`.

### Pergunta (não pontuada)
- **Rate limit só por IP + e-mail** (`auth.routes.ts:17-21` e `:32`): é o que os planos CCD004 e CCD006 decidiram, então não conta como erro. Mas, como a chave inclui o e-mail, um mesmo IP pode tentar senhas em muitas contas (password spraying) ou disparar pedidos de redefinição para muitos e-mails sem bater no limite. Vale avaliar uma segunda camada só por IP (por exemplo, 30/min) no `/login`, no `/google` e no `/password/forgot`? Seria uma mudança de plano, possivelmente com ADR.

## Pontos fortes
- **DIP bem aplicado:** o domínio define as portas que consome (`AuthUsers`, `AuthRepository`, `GoogleIdTokenVerifier`, `MailProvider`, `AuthLogger`, `TransactionRunner`) e o `auth.module.ts` funciona só como composition root. O acesso a `users` passa pela service exportada (`usersService`), nunca pelo repository, como pede o ADR-004.
- **Segurança cuidadosa:**
  - `verifyPasswordInConstantTime` roda o argon2 mesmo quando a conta não existe (linha 160), o que evita enumeração por tempo.
  - `forgotPassword` responde 202 sem esperar nada.
  - Refresh e reset são tokens opacos de 32 bytes, guardados só como hash SHA-256.
  - A rotação detecta reuso e revoga tudo (linhas 315-323, com o `updateMany` condicional como trava otimista).
  - O token de reset é consumido dentro de transação, com revogação das sessões (276-283).
  - Vincular o Google a uma conta com e-mail não verificado descarta a senha (`discardPassword`), o que bloqueia o pre-account takeover.
  - O cookie é `httpOnly`, `SameSite=lax` e tem `Path` restrito.
- **Funções curtas e de baixa complexidade:** a maior complexidade é 6 (`refresh`), nenhum aninhamento passa de 1 nível, e as guard clauses e early returns são usados de forma consistente (`assertCanSignIn`, `findOrLinkGoogleAccount`).
- **Erros de negócio tipados** em `auth.errors.ts`, um por situação, com códigos e status que batem com os planos das specs (por exemplo, `400 INVALID_RESET_TOKEN` em `specs/CCD006-recuperar-senha/plano.md:40`).
- **Soft delete seguido no repository** (`...notDeleted` em todas as consultas). O hard delete só aparece na limpeza de tokens expirados, que o ADR-005 prevê.
- **Testes de comportamento:** fakes em memória injetados pelo construtor, sem mock de módulo, nomes ligados aos critérios de aceite (`CA1`, `CA14`…) e asserções sobre o efeito observável (token gravado com hash, e-mail enviado, sessões revogadas).
- **Código sem comentários**, como o time pede, e os nomes dão conta do recado (`rejectReusedToken`, `issuePasswordReset`, `findResetTarget`).

## Plano de ação
1. **M2:** colocar a rotação do refresh dentro de `runInTransaction`. É a mudança de maior impacto (evita logout geral e falso alarme de segurança) e é pequena.
2. **M3:** deixar explícita a confirmação de e-mail no reset e no vínculo com o Google (extrair `assertAccountUsable` e renomear a porta).
3. **B5:** tratar a corrida no primeiro login com Google, com o mesmo padrão do `register`.
4. **M1:** dividir a `AuthService` em três services por fluxo, junto com a próxima feature de auth. Isso resolve o B1 de quebra.
5. **B2, B3, B7, B8:** ajustes rápidos de constantes, Swagger e tipagem num único `refactor(auth)`.
6. **B6:** trocar a espera fixa do teste por `vi.waitFor` e cobrir a linha 149.
7. Subir o PostgreSQL local e rodar `npm run test:integration` para confirmar controller e repository, que não foram verificados aqui.
8. Levar a Pergunta e o B4 ao time (decisões de plano).

## Métricas
| Métrica | Valor |
|---|---|
| Arquivos analisados | 9 (7 de produção + 2 specs) |
| Maior função (linhas) | `auth.routes.ts:13` `createAuthRoutes`: 22 linhas. No service, `auth.service.ts:385` `startSession`: 20 linhas |
| Maior complexidade ciclomática | `AuthService.refresh` (`auth.service.ts:308`): 6 |
| Maior arquivo | `auth.service.spec.ts`: 770 linhas; produção: `auth.service.ts`, 406 |
| Duplicação | não medido (jscpd não instalado) |
| Cobertura | `auth.service.ts`: 97,6% stmts · 95,3% branches · 100% funcs · 99,1% linhas. Domínio inteiro nos unitários: 61,1% das linhas (controller, repository e routes ficam com os testes de integração, não rodados) |

Conta da nota: 10 − 3 × 0,25 (médios) − 8 × 0,1 (baixos) = 8,45, arredondado para **8,5**. Nenhuma ferramenta falhou, então não se aplica o teto de 6,0.

**Resumo da execução:** 9 arquivos e 1.829 linhas analisados (mais trechos de contexto em `users.service.ts`, `users.repository.ts`, `lib/google.ts`, `lib/password.ts`, `rate-limit.ts` e nos planos CCD004 e CCD006), em cerca de 4 minutos. Achados: 0 críticos, 0 altos, 3 médios e 8 baixos, mais 1 pergunta não pontuada. Nenhum arquivo do repositório foi alterado.
