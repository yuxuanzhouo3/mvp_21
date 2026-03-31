alter table if exists contract_templates
  add column if not exists status text not null default 'active'
    check (status in ('active', 'draft', 'archived'));

alter table if exists contract_templates
  add column if not exists version integer not null default 1;

alter table if exists contract_templates
  add column if not exists source_template_id uuid references contract_templates(id) on delete set null;

alter table if exists contract_templates
  add column if not exists usage_count integer not null default 0;

alter table if exists contract_templates
  add column if not exists last_used_at timestamptz;

create index if not exists idx_contract_templates_owner_status
  on contract_templates(user_id, status, updated_at desc);

create index if not exists idx_contract_templates_lineage
  on contract_templates(source_template_id, version desc);
