create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  target_url text not null,
  clicks int default 0,
  created_at timestamptz default now()
);

create index idx_short_links_code on short_links(code);

alter table short_links enable row level security;
create policy "anon can insert short_links" on short_links for insert to anon, authenticated with check (true);
create policy "anon can read short_links" on short_links for select to anon, authenticated using (true);
create policy "anon can update clicks" on short_links for update to anon, authenticated using (true) with check (true);
