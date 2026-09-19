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

alter table public.caminhoes enable row level security;
alter table public.locais enable row level security;

-- cada motorista só enxerga e mexe nos próprios dados
drop policy if exists "caminhao do dono" on public.caminhoes;
create policy "caminhao do dono" on public.caminhoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "locais do dono" on public.locais;
create policy "locais do dono" on public.locais
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
