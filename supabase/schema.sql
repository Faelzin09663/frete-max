-- Rode este script uma vez no SQL Editor do seu projeto Supabase (supabase.com).
-- Ele cria as tabelas usadas pela sincronização opcional de Caminhão e Locais
-- entre aparelhos. Sem rodar isso, o app continua funcionando 100% localmente.

create table if not exists public.caminhoes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default 'Meu caminhão',
  capacidade_t numeric not null default 30,
  eixos int not null default 6,
  consumo_cheio_kml numeric not null default 2.0,
  consumo_vazio_kml numeric not null default 2.8,
  diesel_rsl numeric not null default 6.2,
  custo_km_rs numeric not null default 1.2,
  fator_tempo numeric not null default 1.3,
  tempo_carga_h numeric not null default 1,
  tempo_descarga_h numeric not null default 1,
  -- aponta para o id de um local (texto, igual ao id gerado no navegador; sem FK
  -- porque o local pode ainda não ter sido sincronizado quando o caminhão é salvo)
  base_local_id text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.locais (
  -- mesmo id (texto curto) gerado no navegador, para não precisar remapear nada
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apelido text not null,
  sinonimos text[] not null default '{}',
  endereco text not null,
  lat double precision not null,
  lng double precision not null,
  criado_em timestamptz not null default now()
);

create index if not exists locais_user_id_idx on public.locais (user_id);

-- Controle de conflito: toda gravação recebe a hora do banco, que é a mesma
-- referência para todos os aparelhos.
alter table public.locais add column if not exists atualizado_em timestamptz not null default now();

create or replace function public.atualizar_timestamp()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists caminhao_atualizado_em on public.caminhoes;
create trigger caminhao_atualizado_em before update on public.caminhoes
for each row execute function public.atualizar_timestamp();

drop trigger if exists local_atualizado_em on public.locais;
create trigger local_atualizado_em before update on public.locais
for each row execute function public.atualizar_timestamp();

alter table public.caminhoes enable row level security;
alter table public.locais enable row level security;

-- cada motorista só enxerga e mexe nos próprios dados
drop policy if exists "caminhao do dono" on public.caminhoes;
create policy "caminhao do dono" on public.caminhoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "locais do dono" on public.locais;
create policy "locais do dono" on public.locais
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Histórico de cargas analisadas (tela "Cargas"): toda carga que passou pela análise,
-- escolhida ou não. Diferente de "viagens" (só as escolhidas/realizadas).
create table if not exists public.cargas (
  -- mesmo id (texto curto) da oferta que originou esta análise, gerado no navegador
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  empresa text,
  grupo text,
  origem_texto text not null,
  destino_texto text not null,
  valor numeric,
  unidade text not null default 'DESCONHECIDA',
  pedagio text not null default 'NAO_INFORMADO',
  agendamento text not null default 'NAO_INFORMADO',
  carregamento_ate text, -- "HH:MM"
  descarga_ate text, -- "HH:MM"
  observacoes text not null default '',
  contato text,

  -- snapshot do cálculo no momento salvo (sem FK: o local pode ainda não estar sincronizado)
  origem_local_id text,
  destino_local_id text,
  lucro_rs numeric,
  lucro_por_hora_rs numeric,
  km_vazio numeric,
  km_cheio numeric,
  km_retorno numeric,
  km_total numeric,
  horas numeric,
  pct_vazio numeric,

  status text not null default 'ANALISADA', -- 'ANALISADA' | 'ESCOLHIDA'
  viagem_id text,
  analisada_em timestamptz not null default now(),
  mensagem_original text,

  criado_em timestamptz not null default now()
);

create index if not exists cargas_user_id_idx on public.cargas (user_id);
create index if not exists cargas_analisada_em_idx on public.cargas (analisada_em desc);

alter table public.cargas add column if not exists atualizado_em timestamptz not null default now();

drop trigger if exists carga_atualizado_em on public.cargas;
create trigger carga_atualizado_em before update on public.cargas
for each row execute function public.atualizar_timestamp();

alter table public.cargas enable row level security;

drop policy if exists "cargas do dono" on public.cargas;
create policy "cargas do dono" on public.cargas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
