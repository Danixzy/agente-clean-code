# Caso 03 — segurança e tratamento de erro

Repositório de usuários com falhas de segurança graves.

## O agente deve apontar
| Achado esperado | Severidade | Regra |
|---|---|---|
| Senha do banco escrita no código | Crítico | OWASP · segredos fora do código |
| SQL montado com interpolação de string (`'${email}'`) | Crítico | OWASP A03 Injection · SQL parametrizado |
| `catch` vazio que engole o erro e devolve `undefined` | Alto | Clean Code cap. 7 |
| Log com o registro inteiro do usuário (dados sensíveis) | Alto | OWASP · dados sensíveis em log |
| `pool.query` sem `await` em `deleteUser` (promessa solta) | Alto | Async · `no-floating-promises` |
| `SELECT *` e retorno sem tipo | Médio/Baixo | TypeScript · contrato explícito |
| Hard delete sem checagem | Médio | Depende da convenção do projeto (soft delete) |

## Nota esperada
Abaixo de 5, com pelo menos 2 achados Críticos.
