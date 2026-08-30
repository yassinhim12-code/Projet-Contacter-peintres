-- شغّل هذا الكود في Supabase -> SQL Editor -> New query -> Run

create table if not exists groups (
  id serial primary key,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id serial primary key,
  name text not null,
  phone text not null,
  group_id int references groups(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'done')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rotation_state (
  id int primary key default 1,
  current_group_index int not null default 0,
  last_run_date date
);

create table if not exists daily_logs (
  id serial primary key,
  run_date date not null unique,
  contact_ids int[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into rotation_state (id, current_group_index)
values (1, 0)
on conflict (id) do nothing;

create index if not exists idx_contacts_status on contacts(status);
create index if not exists idx_contacts_group on contacts(group_id);
