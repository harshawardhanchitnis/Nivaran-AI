-- The smallest stand-in for what a Supabase project provides before our migration runs:
-- the API roles, auth.users, auth.uid(), and the storage tables our policies attach to.
-- Used only by tests/db/policies.test.ts.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);

-- Same expression Supabase uses: the user id comes from the request's JWT claims.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
