create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null,
  user_id uuid,
  email text not null,
  name text,
  avatar text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  invited_by uuid,
  joined_at timestamptz default now(),
  last_active_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create index if not exists idx_workspace_members_owner on workspace_members(workspace_owner_id, created_at desc);
create index if not exists idx_workspace_members_user on workspace_members(user_id);
create index if not exists idx_workspace_members_email on workspace_members(email);

create trigger update_workspace_members_updated_at
before update on workspace_members
for each row execute function update_updated_at_column();
