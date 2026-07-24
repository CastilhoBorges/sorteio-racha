# Sorteio equilibrado por qualidade dos jogadores — Design

**Data:** 2026-07-24
**Status:** aprovado em conversa; aguardando revisão final do spec

## Contexto e objetivo

Hoje o Sorteio do Racha distribui os jogadores de forma puramente aleatória, o que
frequentemente gera times desequilibrados. Esta feature adiciona uma etapa opcional
de avaliação: o organizador dá uma nota de qualidade a cada jogador e o sorteio
distribui os times de forma equilibrada, mantendo a sensação de sorteio.

O app continua sendo uma página única em vanilla HTML/CSS/JS (`index.html`,
`style.css`, `script.js`), sem build, sem backend e sem dependências.

## Decisões de produto

| Decisão | Escolha |
|---|---|
| Escala de qualidade | Estrelas de 1 a 5, um toque por jogador |
| Obrigatoriedade | Opcional — dá pra pular e sortear aleatório como hoje |
| Persistência | Notas salvas no navegador (`localStorage`), por nome |
| Visibilidade das notas | Nota por jogador visível no resultado e no texto do WhatsApp (apenas no sorteio equilibrado) |
| Estrutura de UI | Wizard de 3 etapas na mesma página |

## Fluxo do wizard

Três etapas na mesma página, alternadas com mostra/esconde (`hidden`) e uma variável
de estado `etapaAtual` no script. Sem router, sem múltiplos HTMLs. Indicador
discreto de progresso no topo: `1 Lista · 2 Times · 3 Resultado`.

**Etapa 1 — Lista.** Igual à tela atual: seletor de modalidade (Futsal/Society),
textarea, chips com contador e remoção de nomes. O CTA vira **"Continuar"**
(habilitado com 3+ nomes, como hoje) e leva à etapa 2.

**Etapa 2 — Avaliação.** Lista dos jogadores detectados, cada um com 5 estrelas
tocáveis. CTA principal **"Sortear equilibrado"**; link secundário **"Pular e
sortear aleatório"** (usa o algoritmo atual, intocado); botão **"Voltar"** para a
etapa 1 sem perder nada.

**Etapa 3 — Resultado.** Os três coletes, ações de WhatsApp/copiar/sortear de novo,
e **"Voltar"** que retorna à etapa 2 (ou à 1, se o sorteio foi o aleatório).

O estado (nomes, exclusões, notas, último sorteio) vive no script e sobrevive à
troca de etapas, pois nada é recarregado.

## Etapa de avaliação

**UI.** Uma linha por jogador: nome à esquerda, cinco botões de estrela à direita,
com alvo de toque generoso para celular. Tocar na estrela N define nota N.
Jogador novo começa com 3★; jogador conhecido vem com a nota salva.
Todos os nomes detectados aparecem para avaliação, na ordem da lista — inclusive
quem ficará de "próximo" (a nota fica salva para os rachas seguintes); esses
recebem o mesmo tratamento visual esmaecido dos chips além do corte.

**Persistência.** `localStorage` na chave `sorteioracha:notas`, guardando um objeto
`{ "nome normalizado": 1..5 }`. A normalização é a mesma já usada para deduplicar
(minúsculas, após limpeza da linha). Toda mudança de estrela salva na hora.
Se `localStorage` estiver indisponível (ex.: navegação anônima restrita), as notas
funcionam só na sessão, sem erro visível.

**Nomes iguais.** A regra existente permanece: um nome = um jogador (linhas
duplicadas são deduplicadas na entrada). Dois jogadores de mesmo nome precisam ser
diferenciados na lista (ex.: "João R." e "João Baixinho"). O hint do textarea passa
a mencionar essa dica. Não haverá sistema de IDs.

## Algoritmo do sorteio equilibrado (snake draft)

1. Como hoje, os primeiros `porTime × 3` nomes da lista jogam (ordem da lista =
   prioridade); o restante vai para "próximos".
2. Ordena os que jogam por estrelas, da maior para a menor, **embaralhando
   aleatoriamente os empatados** (jogadores de mesma nota).
3. Distribui em serpentina: Time 1, 2, 3, depois 3, 2, 1, repetindo até acabar.

Propriedades:

- "Sortear de novo" gera times diferentes (o embaralhamento dos empates muda), mas
  sempre equilibrados.
- Se todos têm a mesma nota, o resultado equivale ao sorteio aleatório atual.
- Com lista incompleta, a serpentina garante diferença máxima de 1 jogador por
  time; o aviso amarelo de "faltaram X" continua igual.

## Resultado e exportação

- No sorteio equilibrado, cada nome aparece com a nota ao lado — "João ⭐4" — tanto
  nos cards de colete quanto no texto do WhatsApp/copiar ("• João ⭐4").
- No sorteio aleatório, resultado e texto exportado ficam exatamente como hoje,
  sem estrelas.
- **"Sortear de novo"** repete o mesmo tipo de sorteio que gerou o resultado
  atual: equilibrado repete equilibrado (com novo desempate aleatório),
  aleatório repete aleatório.
- Sem linha extra de "times equilibrados": as estrelas já comunicam isso.

## Casos-limite

- `localStorage` indisponível: notas valem só na sessão; nenhum erro na tela.
- Voltar e editar a lista: notas já dadas ficam guardadas por nome; nomes novos
  entram com 3★.
- Remover jogador com o ×: sai do sorteio, mas a nota salva permanece.
- Mínimo de 3 jogadores para continuar, como hoje.

## Verificação

O projeto não tem npm nem framework de teste, e isso não muda. As funções puras
(limpeza de linha, embaralhamento, ordenação com desempate, snake draft, montagem
do texto) ficam isoladas de DOM dentro do `script.js` para serem verificáveis.
A verificação é um checklist manual no navegador, a ser detalhado no plano de
implementação, cobrindo no mínimo:

- Fluxo completo das 3 etapas nas duas modalidades.
- Pular avaliação → comportamento idêntico ao app atual.
- Persistência das notas após recarregar a página.
- Somas de estrelas dos 3 times com diferença pequena em listas variadas
  (incluindo lista incompleta).
- Texto exportado com e sem estrelas conforme o tipo de sorteio.
- Voltar/avançar entre etapas sem perder estado.

## Fora de escopo

- Backend, contas ou sincronização entre dispositivos.
- Sistema de IDs para jogadores homônimos.
- Posições (goleiro, linha) ou critérios além da nota única.
- Frameworks de UI ou de teste.
