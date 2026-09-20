# FreteMax

Cole a mensagem de carga do WhatsApp (ou o print) e veja qual carga dá mais lucro,
considerando km vazio, km cheio, diesel, pedágio e tempo.

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
| `GEMINI_API_KEY` | Ler mensagens e prints (modelo `gemini-3.1-flash-lite`, troque em `GEMINI_MODEL`) | https://aistudio.google.com/apikey |
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
lib/mapa.ts        monta os trechos (vazio/cheio) e o link do Google Maps
components/RouteMap.tsx  mapa Leaflet + OpenStreetMap (sem chave extra)
app/               telas: Cargas, Locais, Caminhão
```

## Mapa

Cada carga tem "Ver no mapa": trecho vazio tracejado, trecho cheio em linha grossa, e o botão
"Abrir no Google Maps" para navegar. O traçado vem do Routes API (sem chamada extra).
Sem chave do Google, o mapa mostra linhas retas entre os pontos.
Os mapas usam os tiles públicos do OpenStreetMap, bons para uso pessoal; se o app crescer,
troque por um provedor de tiles com plano próprio (em `components/RouteMap.tsx`).

## Limites conhecidos do MVP

- Dados ficam no `localStorage` do navegador (um aparelho, sem login). Fase 3 troca por Supabase.
- Pedágio do Google é estimado para carro/diesel, não por eixos: se souber o valor real, digite no cartão ("Ver a conta").
- Horário de viabilidade considera só o mesmo dia.
- Valor sem unidade ("Tarifa: 45,00") é tratado como por tonelada, com aviso na tela.

## Comparar várias cargas de uma vez

Na tela de Cargas existe um único campo para colar uma ou várias divulgações consecutivas do
WhatsApp, além da opção de enviar vários prints. O Gemini recebe o conteúdo inteiro e devolve uma
oferta para cada rota/fluxo distinto, separando origem, destino, preço, pedágio, horários e
observações de cada bloco. Assim, mensagens como duas ofertas diferentes coladas em sequência são
comparadas juntas sem precisar criar novos campos.

## Painel de viagens e caixa

Depois de analisar as cargas, a tela ordena por padrão pelo **lucro por hora**. Esse indicador já
desconta diesel, manutenção, pedágio e considera o tempo de direção, carregamento, descarga e
retorno configurado. Assim, uma carga que deixa R$ 1.500 em menos tempo pode aparecer como melhor
escolha do que outra que deixa R$ 1.900, se o retorno por hora for maior.

O botão **Escolher e registrar esta carga** salva o retrato financeiro da viagem no aparelho e abre
o **Painel**. O painel mostra lucro semanal, receita bruta, saída do caixa, manutenção reservada,
diesel, pedágio, lucro diário em gráfico e a lista detalhada das viagens registradas. A manutenção
é calculada pelo valor de R$/km configurado em Caminhão e fica separada como valor a reservar para
óleo, pneus, peças e desgaste. Os registros ficam no localStorage deste aparelho nesta fase.

## Fase 3 (parcial): conta e sincronização + PWA com "Compartilhar" (Android)

**Conta (opcional).** Tela `/conta`: login por link mágico (e-mail), sem senha. Sem entrar,
nada muda — continua tudo salvo só no aparelho. Entrando, `lib/storage.ts` passa a
sincronizar **Caminhão** e **Locais** com o Supabase em segundo plano (local-first: a tela
nunca espera a rede, e volta a funcionar offline se a conexão cair). Na primeira vez que
loga numa conta nova, o que já estava salvo no aparelho é enviado para a nuvem uma única vez.
**Cargas continuam só no aparelho** (não fazem parte da Fase 3 ainda).

Para ativar:
1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, rode o arquivo `supabase/schema.sql` (cria as tabelas e as regras
   de segurança — cada motorista só vê os próprios dados).
3. Em Project Settings → API, copie a **Project URL** e a chave **anon public** (nunca a
   `service_role`) para `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`.
4. Em Authentication → URL Configuration, adicione `http://localhost:3000/auth/callback` (e depois
   a URL de produção, ex. `https://seusite.vercel.app/auth/callback`) nas Redirect URLs.

Sem preencher essas chaves, a tela `/conta` avisa que a sincronização não está configurada e
o resto do site funciona normal.

**PWA com "Compartilhar" (Android).** Com `public/manifest.json` + `public/sw.js`, depois de
instalado ("Adicionar à tela inicial" no Chrome), o FreteMax aparece na lista de compartilhamento
do Android. Ele abre uma mensagem no WhatsApp → Compartilhar → FreteMax, e o texto (ou o print)
já chega preenchido na tela de Cargas, sem copiar e colar. Funciona só depois de instalado e só
no Android/ChromeOS — no iPhone, essa função não existe (ver `README` da conversa original);
lá ele continua copiando e colando ou usando o print normalmente.
Detalhe técnico: o `sw.js` intercepta o POST do Android e guarda o conteúdo no Cache Storage;
`app/compartilhar/pronto` lê o cache e entrega para a tela de Cargas via `lib/compartilhado.ts`.
`app/compartilhar/route.ts` é só uma rede de segurança para antes do service worker estar ativo
(nesse caso raro, o texto chega mas a imagem não, e a tela avisa).

**Compressão de imagem.** Prints grandes são reduzidos no navegador (`lib/imagem.ts`, até 1600px
no lado maior) antes de enviar pro `/api/extract`, pra gastar menos do plano de dados dele.

### O que eu não consegui testar aqui
Sem internet nem `npm install` neste ambiente, não rodei nada desta parte — nem o login, nem a
sincronização, nem o compartilhamento do Android. Revisei o código com cuidado, mas é essencial
testar na prática, principalmente:
- O fluxo de login por link mágico ponta a ponta (e-mail → `/auth/callback` → `/conta`).
- Compartilhar uma mensagem do WhatsApp pro FreteMax instalado num Android de verdade.
- Editar um local ou o caminhão logado em dois aparelhos e ver se sincroniza nos dois.

## Melhor sequência de cargas (casa → carga → carga → casa)

Quando a análise tem 2 ou mais cargas com preço e locais cadastrados, aparece o painel
**Melhor sequência**. Ele testa todas as ordens possíveis de até 2 a 5 cargas em fila
(com 10 propostas e 3 cargas são ~800 combinações; com 4, ~5.800), saindo do ponto escolhido
em *Onde você está agora* (ou da **Base** de Caminhão) e, se quiser, voltando para a Base.

Para cada sequência conta: km vazio até a primeira origem, km cheio, km vazio entre uma
descarga e a próxima origem, a volta, diesel, manutenção, pedágio (o reembolsado não entra),
tempo de carga/descarga, e o relógio andando carga a carga para respeitar o
"carregamento até HH:MM" de cada uma. Sequências que não chegam a tempo são descartadas.

O ranking mostra as 3 melhores, cada uma com a explicação em português (por que pegar:
quanto anda vazio, se a próxima carga fica perto do destino, se termina perto de casa),
linha do tempo com horários, conta detalhada e mapa da rota inteira. O critério pode ser
**lucro por hora** (padrão) ou **lucro total**. *Escolher esta sequência* registra uma
viagem por carga no Painel.

**Como não gasta rota à toa.** A busca roda primeiro com distâncias estimadas (grátis, em
linha reta × 1,35) e só as melhores sequências recebem a rota real do Google. Com 10
propostas isso costuma dar algumas dezenas de consultas na primeira vez (o máximo teórico
seria mais de 100), e cada trecho fica guardado. O texto explicativo é gerado por código:
não usa IA.

Código: `lib/plano.ts` (motor, testado em `scripts/test-plano.ts`), `lib/mapa.ts`
(`montarMapaPlano`), `components/PlanoPanel.tsx` (tela).

## Memória: a análise não some mais

- **Sessão** (`lib/sessao.tsx`): mensagem, posição, toneladas, ofertas lidas, revisão e
  sequência ficam guardadas. Sair para Caminhão/Locais e voltar (ou recarregar o app) mantém
  tudo. Vale por 24 h; *Limpar* começa uma análise nova. Os prints em si não são guardados
  (são pesados), mas as ofertas lidas a partir deles sim.
- **IA** (`lib/cache-ia.ts`): a mesma mensagem/print enviado de novo reaproveita a leitura
  anterior e não chama o Gemini. Guarda 40 leituras por 14 dias.
- **Rotas** (`lib/client-api.ts`): cada trecho A→B é pedido ao Google uma vez e fica em
  memória e no aparelho por 60 dias (até 400 trechos). Pedidos iguais simultâneos viram um só.

## Próximos passos (Fase 4)

Viagens concluídas, dashboard semanal, exportação para planilha, leitura de tíquete de descarga,
histórico de preço por rota, sugestão de retorno por região.

## Problemas comuns

**`Module not found: Can't resolve '@supabase/supabase-js'`**
A dependência já está no `package.json`, mas a pasta `node_modules` ficou desatualizada
(instalada antes de o Supabase entrar no projeto). Reinstale limpo:

```bash
rm -rf node_modules .next
npm install
npm run dev
```

No Windows (PowerShell): `Remove-Item -Recurse -Force node_modules, .next; npm install`.
Na Vercel, use **Redeploy → sem cache** (Clear Build Cache).
