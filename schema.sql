-- ============================================================
-- Visali Designer Ledger — schema
-- Run once: Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- SERVICE TYPES — the fixed list of things the shop stitches.
-- Editable in Settings so the shop can add its own.
-- ------------------------------------------------------------
create table service_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  default_price numeric(10,2) default 0,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CUSTOMERS — name and phone. Phone is how we message them.
-- ------------------------------------------------------------
create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create unique index customers_phone_idx on customers(phone);
create index customers_name_idx on customers(lower(name));

-- ------------------------------------------------------------
-- ORDERS
-- due_date is a plain date, due_time a plain time. No timezone
-- maths on a shop counter.
-- ------------------------------------------------------------
create table orders (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete restrict,
  order_no      bigint generated always as identity,

  order_date    date not null default current_date,
  due_date      date not null,
  due_time      time,

  status        text not null default 'open'
                check (status in ('open','ready','delivered','cancelled')),

  delivery_mode text not null default 'pickup'
                check (delivery_mode in ('pickup','courier')),
  courier_name    text,
  courier_tracking text,
  courier_receipt_url text,

  total_amount  numeric(10,2) not null default 0,
  notes         text,

  delivered_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index orders_due_idx    on orders(due_date);
create index orders_status_idx on orders(status);

-- ------------------------------------------------------------
-- ORDER ITEMS — one row per service on an order.
-- completed_qty is what makes partial completion work:
-- 10 blouses ordered, 2 finished today.
-- service_name is snapshotted so renaming a service later
-- does not rewrite history.
-- ------------------------------------------------------------
create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  service_type_id uuid references service_types(id) on delete set null,
  service_name  text not null,

  qty           int not null default 1 check (qty > 0),
  completed_qty int not null default 0 check (completed_qty >= 0),
  unit_price    numeric(10,2) not null default 0,

  design_ref_url text,
  item_notes    text,

  created_at    timestamptz not null default now(),
  constraint completed_not_over check (completed_qty <= qty)
);

create index order_items_order_idx on order_items(order_id);

-- ------------------------------------------------------------
-- PAYMENTS — advance at order time, balance on delivery.
-- Kept as rows rather than a single "paid" column so the shop
-- can see when money actually came in.
-- ------------------------------------------------------------
create table payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  amount     numeric(10,2) not null,
  paid_on    date not null default current_date,
  method     text default 'cash',
  note       text,
  created_at timestamptz not null default now()
);

create index payments_order_idx on payments(order_id);

-- ------------------------------------------------------------
-- MESSAGE LOG — what was sent to whom, and when.
-- The app opens WhatsApp with text prefilled; this records
-- that the shop chose to send it.
-- ------------------------------------------------------------
create table message_log (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  channel    text not null default 'whatsapp',
  body       text not null,
  sent_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SETTINGS — shop name, editable message templates.
-- Single row.
-- ------------------------------------------------------------
create table shop_settings (
  id              int primary key default 1 check (id = 1),
  shop_name       text not null default 'My Tailoring',
  country_code    text not null default '91',
  msg_ready       text not null default
    'Hello {customer}, your order is ready. {items} Please collect it at your convenience. Thank you. {shop}',
  msg_courier     text not null default
    'Hello {customer}, your order has been couriered. {items} Tracking: {tracking}. Thank you. {shop}',
  msg_reminder    text not null default
    'Hello {customer}, a reminder that your order is due on {due}. Thank you. {shop}',
  updated_at      timestamptz not null default now()
);

insert into shop_settings (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------
-- VIEW — order rollup. Saves computing totals on the client.
-- ------------------------------------------------------------
create or replace view order_summary as
select
  o.id,
  o.order_no,
  o.customer_id,
  c.name  as customer_name,
  c.phone as customer_phone,
  o.order_date,
  o.due_date,
  o.due_time,
  o.status,
  o.delivery_mode,
  o.courier_name,
  o.courier_tracking,
  o.courier_receipt_url,
  o.total_amount,
  o.notes,
  o.delivered_at,
  o.created_at,
  coalesce(i.total_qty, 0)      as total_qty,
  coalesce(i.completed_qty, 0)  as completed_qty,
  coalesce(p.paid, 0)           as amount_paid,
  o.total_amount - coalesce(p.paid, 0) as amount_due
from orders o
join customers c on c.id = o.customer_id
left join (
  select order_id, sum(qty) total_qty, sum(completed_qty) completed_qty
  from order_items group by order_id
) i on i.order_id = o.id
left join (
  select order_id, sum(amount) paid from payments group by order_id
) p on p.order_id = o.id;

-- ------------------------------------------------------------
-- SEED — common services. Prices are placeholders; edit in Settings.
-- ------------------------------------------------------------
insert into service_types (name, default_price, sort_order) values
  ('Blouse stitching',        350, 1),
  ('Designer blouse',         750, 2),
  ('Aari work blouse',       1500, 3),
  ('Chudidhar / Salwar',      600, 4),
  ('Kurti',                   450, 5),
  ('Lehenga',                2500, 6),
  ('Gown',                   1800, 7),
  ('Pant / Palazzo',          400, 8),
  ('Skirt',                   400, 9),
  ('Saree falls & pico',      120, 10),
  ('Blouse alteration',       150, 11),
  ('Dress alteration',        200, 12)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- One shop, a few staff. Everyone signed in sees everything.
-- Nobody signed out sees anything.
-- ------------------------------------------------------------
alter table service_types  enable row level security;
alter table customers      enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table payments       enable row level security;
alter table message_log    enable row level security;
alter table shop_settings  enable row level security;

create policy "staff read services"   on service_types for select to authenticated using (true);
create policy "staff write services"  on service_types for all    to authenticated using (true) with check (true);

create policy "staff read customers"  on customers for select to authenticated using (true);
create policy "staff write customers" on customers for all    to authenticated using (true) with check (true);

create policy "staff read orders"     on orders for select to authenticated using (true);
create policy "staff write orders"    on orders for all    to authenticated using (true) with check (true);

create policy "staff read items"      on order_items for select to authenticated using (true);
create policy "staff write items"     on order_items for all    to authenticated using (true) with check (true);

create policy "staff read payments"   on payments for select to authenticated using (true);
create policy "staff write payments"  on payments for all    to authenticated using (true) with check (true);

create policy "staff read messages"   on message_log for select to authenticated using (true);
create policy "staff write messages"  on message_log for all    to authenticated using (true) with check (true);

create policy "staff read settings"   on shop_settings for select to authenticated using (true);
create policy "staff write settings"  on shop_settings for all    to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- PRIORITY ASSISTANT — courier destination + transit-time zones
-- so the "Today" tab can work backwards from due_date to a
-- ship-by / finish-by date instead of treating every order the
-- same regardless of how far it has to travel.
-- ------------------------------------------------------------
alter table orders add column if not exists courier_destination text;

create table if not exists courier_zones (
  id          uuid primary key default gen_random_uuid(),
  place_match text not null,
  lead_days   int not null check (lead_days >= 0),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create unique index if not exists courier_zones_match_idx on courier_zones(lower(place_match));

alter table courier_zones enable row level security;
create policy "staff read courier zones"  on courier_zones for select to authenticated using (true);
create policy "staff write courier zones" on courier_zones for all    to authenticated using (true) with check (true);

insert into courier_zones (place_match, lead_days, sort_order) values
  ('karur',            1, 1),
  ('coimbatore',       1, 2),
  ('erode',            1, 3),
  ('tirupur',          1, 4),
  ('salem',            2, 5),
  ('tamil nadu',       2, 6),
  ('chennai',          2, 7),
  ('india',            4, 8),
  ('usa',              7, 9),
  ('united states',    7, 10),
  ('uk',               7, 11),
  ('united kingdom',   7, 12),
  ('canada',           7, 13),
  ('australia',        7, 14),
  ('international',    7, 15)
on conflict (lower(place_match)) do nothing;

alter table shop_settings add column if not exists daily_capacity int not null default 8;
alter table shop_settings add column if not exists courier_default_lead_days int not null default 4;

-- ------------------------------------------------------------
-- CUSTOMER NUMBER — a short sequential id ("#7") shown next to
-- the customer's name, same pattern as orders.order_no. Assigned
-- once per customer, which is already deduped by phone.
-- ------------------------------------------------------------
alter table customers add column if not exists customer_no bigint generated always as identity;

-- ------------------------------------------------------------
-- MATERIAL COSTS — a plain log of what was bought to run the
-- shop (fabric, thread, linings...). Deliberately separate from
-- orders/revenue; nothing joins to it.
-- ------------------------------------------------------------
create table if not exists material_costs (
  id            uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  item          text not null,
  quantity      numeric(10,2),
  unit          text,
  cost          numeric(10,2) not null default 0,
  supplier      text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists material_costs_date_idx on material_costs(purchase_date);

alter table material_costs enable row level security;
create policy "staff read materials"  on material_costs for select to authenticated using (true);
create policy "staff write materials" on material_costs for all    to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- CUSTOMER NUMBER → EDITABLE
-- Was generated-always identity (immutable). The shop's paper
-- ledger already has numbers for existing customers that won't
-- match an auto-assigned sequence, so this becomes a plain
-- column with a sequence default — new customers still auto-
-- number, but any number can be edited afterward.
-- ------------------------------------------------------------
alter table customers alter column customer_no drop identity if exists;
create sequence if not exists customers_customer_no_seq owned by customers.customer_no;
select setval(
  'customers_customer_no_seq',
  coalesce((select max(customer_no)::bigint from customers), 1::bigint),
  exists (select 1 from customers)
);
alter table customers alter column customer_no set default nextval('customers_customer_no_seq');

-- ------------------------------------------------------------
-- ORDERS — soft delete (recycle bin) + measurements
-- ------------------------------------------------------------
alter table orders add column if not exists deleted_at timestamptz;
alter table orders add column if not exists measurements text;
create index if not exists orders_deleted_idx on orders(deleted_at);

create or replace view order_summary as
select
  o.id,
  o.order_no,
  o.customer_id,
  c.customer_no as customer_no,
  c.name  as customer_name,
  c.phone as customer_phone,
  o.order_date,
  o.due_date,
  o.due_time,
  o.status,
  o.delivery_mode,
  o.courier_name,
  o.courier_tracking,
  o.courier_receipt_url,
  o.courier_destination,
  o.total_amount,
  o.notes,
  o.measurements,
  o.deleted_at,
  o.delivered_at,
  o.created_at,
  coalesce(i.total_qty, 0)      as total_qty,
  coalesce(i.completed_qty, 0)  as completed_qty,
  coalesce(p.paid, 0)           as amount_paid,
  o.total_amount - coalesce(p.paid, 0) as amount_due
from orders o
join customers c on c.id = o.customer_id
left join (
  select order_id, sum(qty) total_qty, sum(completed_qty) completed_qty
  from order_items group by order_id
) i on i.order_id = o.id
left join (
  select order_id, sum(amount) paid from payments group by order_id
) p on p.order_id = o.id;

-- ------------------------------------------------------------
-- SPENDING — renamed from material_costs, broadened beyond just
-- fabric/thread purchases (rent, electricity, wages...) to match
-- the tab name. Deliberately separate from orders/revenue.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'material_costs')
     and not exists (select 1 from information_schema.tables where table_name = 'spending') then
    alter table material_costs rename to spending;
  end if;
end $$;

create table if not exists spending (
  id            uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  category      text not null default 'material'
                check (category in ('material','rent','electricity','wages','transport','other')),
  item          text not null,
  quantity      numeric(10,2),
  unit          text,
  cost          numeric(10,2) not null default 0,
  supplier      text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- present if this table used to be material_costs, which predates the category column
alter table spending add column if not exists category text not null default 'material';

create index if not exists spending_date_idx on spending(purchase_date);

alter table spending enable row level security;
drop policy if exists "staff read materials"  on spending;
drop policy if exists "staff write materials" on spending;
drop policy if exists "staff read spending"   on spending;
drop policy if exists "staff write spending"  on spending;
create policy "staff read spending"  on spending for select to authenticated using (true);
create policy "staff write spending" on spending for all    to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- STORAGE — camera/gallery photos for design references, plus
-- courier receipts. Bucket is public so a saved photo URL just
-- works when opened, no signed URLs to manage.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('uploads','uploads', true)
  on conflict (id) do nothing;

drop policy if exists "staff upload files" on storage.objects;
drop policy if exists "anyone read uploaded files" on storage.objects;
create policy "staff upload files" on storage.objects for insert
  to authenticated with check (bucket_id = 'uploads');
create policy "anyone read uploaded files" on storage.objects for select
  to public using (bucket_id = 'uploads');
