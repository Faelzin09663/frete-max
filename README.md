# FreteMax

Cole a mensagem de carga do WhatsApp (ou o print) e veja qual carga dá mais lucro,
considerando km vazio, km cheio, diesel, pedágio e tempo.
6
**Como funciona:** o Gemini só *lê* a mensagem e devolve dados estruturados.
Quem faz a conta (lucro, lucro por hora, viabilidade de horário) é código normal em `lib/calc.ts`,
com testes. Assim o resultado é sempre o mesmo e dá para conferir.

## Rodar

```bash
npm install
cp .env.example .env.local     # preencha as chaves
npm run dev                    # http://localhost:3000
npm test                       # testes do cálculo
```

### Chaves (`.env.local`)

| Variável | Para quê | Onde criar |
|---|---|---|
| `GEMINI_API_KEY` | Ler mensagens e prints | https://aistudio.google.com/apikey |
| `GOOGLE_MAPS_API_KEY` | Endereço → coordenadas e rotas com pedágio | Google Cloud: ativar **Geocoding API** e **Routes API** |

Sem `GOOGLE_MAPS_API_KEY` o app ainda funciona: distâncias são estimadas (linha reta × 1,35)
e os locais são cadastrados colando coordenadas (`-19.9245, -43.9352`) em vez do endereço.
Os resultados aparecem com o aviso "Distâncias estimadas".

As chaves ficam só no servidor (rotas em `app/api/*`); o navegador nunca as vê.

## Primeiro uso

1. **Caminhão**: ajuste capacidade, consumo cheio/vazio, diesel e custo por km (os valores iniciais são exemplos).
2. **Locais**: cadastre os pontos que aparecem nas mensagens (Extrativa, Rocha, Sete Lagoas...).
   Também dá para cadastrar na hora: quando a IA citar um nome desconhecido, o app pede o endereço.
3. **Cargas**: escolha onde você está, cole a mensagem e toque em *Analisar cargas*.

Mensagem de teste:

```
✅ TEJUCANA - ROCHA (Brumadinho) para:
SETE LAGOAS
Frete: R$40,00 ton. + Pedágio
Carregamento até 11:30hrs
Descarga: Até às 18:00hs
PLACA MARCADA
TROCA SOMENTE NO POSTO
```

## Estrutura

```
lib/calc.ts        cálculo de lucro, lucro/hora e viabilidade (puro, testado)
lib/match.ts       liga "Tejucana - Rocha (Brumadinho)" ao local cadastrado
app/api/extract    Gemini: texto/imagem -> JSON de ofertas
app/api/geocode    endereço -> coordenadas
app/api/route      Google Routes: km, tempo e pedágio (com cache no navegador)
app/               telas: Cargas, Locais, Caminhão
```

## Limites conhecidos do MVP

- Dados ficam no `localStorage` do navegador (um aparelho, sem login). Fase 3 troca por Supabase.
- Pedágio do Google é estimado para carro/diesel, não por eixos: se souber o valor real, digite no cartão ("Ver a conta").
- Horário de viabilidade considera só o mesmo dia.
- Valor sem unidade ("Tarifa: 45,00") é tratado como por tonelada, com aviso na tela.

## Próximos passos (Fase 2)

Histórico de preço por rota, comparar retorno por região, viabilidade de descarga,
salvar viagens concluídas para o dashboard semanal.
