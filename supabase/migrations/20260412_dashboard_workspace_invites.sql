create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null,
  member_id uuid,
  email text not null,
  name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz,
  invited_by uuid,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
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

create index if not exists idx_workspace_invites_owner_created
  on workspace_invites(workspace_owner_id, created_at desc);

create index if not exists idx_workspace_invites_owner_email_status
  on workspace_invites(workspace_owner_id, email, status);

create index if not exists idx_workspace_invites_member_status
  on workspace_invites(member_id, status);

drop trigger if exists update_workspace_invites_updated_at on workspace_invites;
create trigger update_workspace_invites_updated_at
before update on workspace_invites
for each row execute function update_updated_at_column();
