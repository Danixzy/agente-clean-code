# Caso 02 — nomes ruins, função longa e aninhada

Cálculo do valor de uma troca de cartas escrito do jeito errado de propósito.

## O agente deve apontar
| Achado esperado | Regra |
|---|---|
| Nomes sem significado: `proc`, `d`, `u`, `t`, `x`, `y`, `r`, `st`, `v` | Clean Code cap. 2 |
| 6 parâmetros, dois deles sem uso (`x`, `y`) | Clean Code cap. 3 · Long Parameter List · YAGNI |
| Parâmetro booleano que muda o comportamento (`flag`) | Flag argument |
| Números mágicos: `1`, `2`, `0.9`, `0.5`, `5000`, `150`, `1.05` | Replace Magic Number with Constant |
| Aninhamento de 5 níveis e `else` desnecessário | Guard clauses · Object Calisthenics 1 e 2 |
| `any` nos parâmetros | TypeScript estrito |
| `==` no lugar de `===` | ESLint `eqeqeq` |
| Código comentado (`// console.log(r)`) e comentário que repete o código | Clean Code cap. 4 |
| `r = r * 1.0` sem efeito | Código morto |
| Função faz várias coisas (desconto por status, taxa, abatimento, ajuste por papel) | SRP · Long Method |

## Nota esperada
Abaixo de 5 (Precisa de refatoração).
