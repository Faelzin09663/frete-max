-- Insere os locais que já estavam cadastrados na primeira versão (localStorage)
-- direto no Supabase, para a conta do seu pai. Roda no SQL Editor do projeto.
--
-- Troque 'EMAIL_DO_SEU_PAI_AQUI' pelo e-mail que ele usou para entrar em /conta
-- (ele precisa ter feito login pelo menos uma vez antes, para existir em auth.users).
--
-- É seguro rodar mais de uma vez: se o id já existir, só atualiza os dados
-- (ON CONFLICT), não duplica.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'EMAIL_DO_SEU_PAI_AQUI';

  if v_user_id is null then
    raise exception 'Nenhum usuário encontrado com esse e-mail. Ele precisa entrar em /conta pelo menos uma vez antes.';
  end if;

  insert into public.locais (id, user_id, apelido, sinonimos, endereco, lat, lng)
  values
    ('hbst3ee0', v_user_id, 'TEJUCANA', ARRAY['ROCHA', 'ROCHA mineradora']::text[], 'R. Antônio Silvério, 175 - Brumadinho, MG, 35460-000, Brasil', -20.1183792, -44.1584203),
    ('weq65nfn', v_user_id, 'SETE LAGOAS', ARRAY['Multilift Terminal Rodoferroviário de Sete Lagoas']::text[], 'R. Equador, 2350 - Santa Maria, Sete Lagoas - MG, 35702-087, Brasil', -19.4750626, -44.2108505),
    ('8d5wkg9o', v_user_id, 'SCOF', '{}', 'Conselheiro Lafaiete - MG, 36400-000, Brasil', -20.5673203, -43.80966309999999),
    ('thqe9x71', v_user_id, 'ECKO', ARRAY['ECKO MINING']::text[], 'BR-040 - Miguel Burnier, Ouro Preto - MG, Brasil', -20.4190434, -43.8836756),
    ('d2yt407g', v_user_id, 'CASA', ARRAY['CASA', 'casa netinho']::text[], 'R. Rutilo, 48 - Glória, Belo Horizonte - MG, 30880-600, Brasil', -19.9088247, -44.0210304),
    ('fhz0qjjz', v_user_id, 'EXTRATIVA', ARRAY['EXTRATIVA MINERAÇÂO', 'extrativa']::text[], 'V4P2+X6, Nova Lima - MG, Brasil', -20.1125619, -43.899437)
  on conflict (id) do update set
    user_id = excluded.user_id,
    apelido = excluded.apelido,
    sinonimos = excluded.sinonimos,
    endereco = excluded.endereco,
    lat = excluded.lat,
    lng = excluded.lng;
end $$;
