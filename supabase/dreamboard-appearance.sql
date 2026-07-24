-- Appearance: add the Midnight Garden theme to the profile theme constraint and
-- a reduce_motion preference. Run after dreamboard-core-schema.sql.
alter table public.dreamboard_profiles drop constraint if exists dreamboard_profiles_theme_check;
alter table public.dreamboard_profiles
  add constraint dreamboard_profiles_theme_check
  check (theme in ('emerald-gold', 'midnight-garden', 'midnight-gold', 'violet-gold', 'blue-gold'));
alter table public.dreamboard_profiles
  add column if not exists reduce_motion boolean not null default false;
