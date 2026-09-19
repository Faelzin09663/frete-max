import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPT = `Você extrai ofertas de frete de mensagens de WhatsApp de grupos de caminhoneiros (Minas Gerais, Brasil).
A entrada pode conter VÁRIAS divulgações coladas em sequência e/ou prints de conversa. Devolva UMA entrada para cada rota/fluxo distinto, mesmo quando várias ofertas estiverem no mesmo texto.

Regras:
- "A x B" ou "A X B" significa origem A e destino B. "A para B" também. Uma mensagem de programação pode ter vários fluxos: separe todos.
- Quando aparecer uma nova origem, novo destino, novo preço/frete ou um novo bloco de divulgação (por exemplo, após um telefone, várias linhas vazias ou uma nova linha com ✅), comece uma nova oferta. Nunca misture preço, horário, contato ou observações de um bloco com outro.
- Se um bloco tiver origem e destino escritos em linhas separadas, associe o preço e os horários daquele bloco à rota correspondente. No exemplo "TEJUCANA - ROCHA (Brumadinho) para: SETE LAGOAS", a origem é "TEJUCANA - ROCHA (Brumadinho)" e o destino é "SETE LAGOAS".
- origemTexto/destinoTexto: copie o nome como aparece, sem emojis. Se houver cidade entre parênteses, mantenha (ex.: "Tejucana - Rocha (Brumadinho)").
- valor: número em reais (45,00 -> 45). Se não houver preço para o fluxo, use null. NUNCA invente valores.
- unidade: "TONELADA" se disser ton./tonelada/t, "VIAGEM" se for valor fechado por viagem, senão "DESCONHECIDA". "Tarifa" sozinha sem unidade = "DESCONHECIDA".
- pedagio: "REEMBOLSADO" se disser "+ pedágio" ou pedágio por conta do contratante; "POR_CONTA_DO_MOTORISTA" se disser pedágio incluso/por conta do motorista; senão "NAO_INFORMADO".
- carregamentoAte / descargaAte: horário limite em "HH:MM" (24h). "Carregamento até 11:30hrs" -> "11:30". Faixa "de 05h às 20h": use o fim da faixa em carregamentoAte. Se não houver, null.
- agendamento: "PLACA_MARCADA" se disser placa marcada; "SEM_AGENDAMENTO" se disser chegar e carregar sem agendar; senão "NAO_INFORMADO".
- observacoes: restrições importantes em uma frase curta (ex.: "Troca somente no posto", "Pagamento via PIX com foto do tíquete", "Pelo aplicativo betruck", "Carregamento amanhã de manhã"). Vazio se nada.
- contato: telefone e nome, se houver.
Ignore textos que não sejam ofertas de carga.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    ofertas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          origemTexto: { type: "STRING" },
          destinoTexto: { type: "STRING" },
          valor: { type: "NUMBER", nullable: true },
          unidade: { type: "STRING", enum: ["TONELADA", "VIAGEM", "DESCONHECIDA"] },
          pedagio: { type: "STRING", enum: ["REEMBOLSADO", "POR_CONTA_DO_MOTORISTA", "NAO_INFORMADO"] },
          carregamentoAte: { type: "STRING", nullable: true },
          descargaAte: { type: "STRING", nullable: true },
          agendamento: { type: "STRING", enum: ["PLACA_MARCADA", "SEM_AGENDAMENTO", "NAO_INFORMADO"] },
          observacoes: { type: "STRING" },
          contato: { type: "STRING", nullable: true },
        },
        required: ["origemTexto", "destinoTexto", "valor", "unidade", "pedagio", "agendamento", "observacoes"],
      },
    },
  },
  required: ["ofertas"],
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada. Crie o arquivo .env.local (veja .env.example)." },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const texto = String(form.get("texto") ?? "").trim();
  const arquivos = form.getAll("imagens").filter((f): f is File => f instanceof File && f.size > 0);
  if (!texto && arquivos.length === 0) {
    return NextResponse.json({ error: "Cole uma mensagem ou envie um print." }, { status: 400 });
  }

  const parts: unknown[] = [];
  if (texto) parts.push({ text: `Mensagem colada:\n${texto}` });
  for (const f of arquivos) {
    const buf = Buffer.from(await f.arrayBuffer());
    parts.push({ inlineData: { mimeType: f.type || "image/png", data: buf.toString("base64") } });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        // Gemini 3: não mexer na temperatura (o Google recomenda o padrão 1.0).
        // Extração é tarefa simples, então pouco "raciocínio" já basta e sai mais barato.
        thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING_LEVEL || "low" },
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    }),
  });

  if (!r.ok) {
    const detalhe = await r.text();
    return NextResponse.json({ error: `Gemini respondeu ${r.status}`, detalhe }, { status: 502 });
  }

  const data = await r.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return NextResponse.json({ error: "Resposta vazia do Gemini." }, { status: 502 });

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ ofertas: parsed.ofertas ?? [] });
  } catch {
    return NextResponse.json({ error: "Não consegui ler a resposta da IA.", detalhe: raw }, { status: 502 });
  }
}
