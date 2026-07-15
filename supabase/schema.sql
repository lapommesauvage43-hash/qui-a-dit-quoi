-- Schéma de la base "Qui a dit quoi ?"
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Peut être ré-exécuté sans danger (idempotent).

create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_order double precision not null default 0,
  published boolean not null default true,
  image_path text not null
);

-- Maintient updated_at à jour automatiquement.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- Sécurité au niveau des lignes (RLS)
alter table public.posts enable row level security;

-- Tout le monde peut lire les publications publiées.
drop policy if exists "public_read_published" on public.posts;
create policy "public_read_published"
on public.posts for select
to anon, authenticated
using (published = true);

-- Seul un administrateur connecté peut créer/modifier/supprimer.
drop policy if exists "admin_insert" on public.posts;
create policy "admin_insert"
on public.posts for insert
to authenticated
with check (true);

drop policy if exists "admin_update" on public.posts;
create policy "admin_update"
on public.posts for update
to authenticated
using (true)
with check (true);

drop policy if exists "admin_delete" on public.posts;
create policy "admin_delete"
on public.posts for delete
to authenticated
using (true);

-- L'administrateur doit aussi voir ses posts non publiés (aucun pour l'instant,
-- mais l'architecture le permet dès la V1) :
drop policy if exists "admin_read_all" on public.posts;
create policy "admin_read_all"
on public.posts for select
to authenticated
using (true);

-- Stockage : bucket public pour les images des publications.
insert into storage.buckets (id, name, public)
values ('posts-images', 'posts-images', true)
on conflict (id) do nothing;

-- Lecture publique des fichiers du bucket.
drop policy if exists "public_read_images" on storage.objects;
create policy "public_read_images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'posts-images');

-- Seul un administrateur connecté peut déposer/supprimer des images.
drop policy if exists "admin_write_images" on storage.objects;
create policy "admin_write_images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'posts-images');

drop policy if exists "admin_delete_images" on storage.objects;
create policy "admin_delete_images"
on storage.objects for delete
to authenticated
using (bucket_id = 'posts-images');
