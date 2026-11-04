-- A missing preference defaults to the dark theme for existing and new accounts.
alter table public.profiles
  add column theme_preference text not null default 'dark'
  check (theme_preference in ('dark', 'light'));

grant update (theme_preference) on public.profiles to authenticated;
