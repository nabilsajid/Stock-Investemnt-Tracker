-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure columns exist if table was pre-existing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name') then
    alter table public.profiles add column full_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email') then
    alter table public.profiles add column email text;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Allow select profiles" on public.profiles;
create policy "Allow select profiles"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill any pre-existing users from auth.users into public.profiles
insert into public.profiles (id, email, full_name, created_at, updated_at)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  created_at,
  coalesce(updated_at, now())
from auth.users
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name);

-- ============================================
-- COMPANIES TABLE
-- ============================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exchange_type') then
    create type public.exchange_type as enum ('DSE', 'CSE');
  end if;
end $$;

create table if not exists public.companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  symbol text not null,
  exchange public.exchange_type not null default 'DSE',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, symbol, exchange)
);

alter table public.companies enable row level security;

drop policy if exists "Users can view own companies" on public.companies;
drop policy if exists "Allow select companies" on public.companies;
create policy "Allow select companies"
  on public.companies for select
  using (true);

drop policy if exists "Users can insert own companies" on public.companies;
create policy "Users can insert own companies"
  on public.companies for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own companies" on public.companies;
create policy "Users can update own companies"
  on public.companies for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own companies" on public.companies;
create policy "Users can delete own companies"
  on public.companies for delete
  using (auth.uid() = user_id);

create index if not exists idx_companies_user_id on public.companies(user_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('BUY', 'SELL');
  end if;
end $$;

create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  type public.transaction_type not null,
  date date not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  price_per_share numeric(18, 4) not null check (price_per_share > 0),
  gross_amount numeric(18, 4) not null,
  brokerage_rate numeric(8, 6) not null default 0.005000,
  brokerage_amount numeric(18, 4) not null,
  net_amount numeric(18, 4) not null,
  cost_basis_of_sold numeric(18, 4),
  realized_profit_loss numeric(18, 4),
  pre_sale_avg_cost numeric(18, 4),
  additional_charges numeric(18, 4) default 0,
  additional_charges_note text,
  notes text,
  sequence integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.transactions enable row level security;

drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Allow select transactions" on public.transactions;
create policy "Allow select transactions"
  on public.transactions for select
  using (true);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

create index if not exists idx_transactions_user_company on public.transactions(user_id, company_id);
create index if not exists idx_transactions_user_date on public.transactions(user_id, date);
create index if not exists idx_transactions_company_date on public.transactions(company_id, date, sequence);

-- ============================================
-- MARKET PRICES TABLE
-- ============================================
create table if not exists public.market_prices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  price numeric(18, 4) not null check (price > 0),
  updated_at timestamptz default now() not null,
  unique(user_id, company_id)
);

alter table public.market_prices enable row level security;

drop policy if exists "Users can view own market prices" on public.market_prices;
create policy "Users can view own market prices"
  on public.market_prices for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own market prices" on public.market_prices;
create policy "Users can insert own market prices"
  on public.market_prices for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own market prices" on public.market_prices;
create policy "Users can update own market prices"
  on public.market_prices for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own market prices" on public.market_prices;
create policy "Users can delete own market prices"
  on public.market_prices for delete
  using (auth.uid() = user_id);

create index if not exists idx_market_prices_user_company on public.market_prices(user_id, company_id);

-- ============================================
-- MARKET PRICE HISTORY TABLE
-- ============================================
create table if not exists public.market_price_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  price numeric(18, 4) not null check (price > 0),
  recorded_at timestamptz default now() not null
);

alter table public.market_price_history enable row level security;

drop policy if exists "Users can view own price history" on public.market_price_history;
create policy "Users can view own price history"
  on public.market_price_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own price history" on public.market_price_history;
create policy "Users can insert own price history"
  on public.market_price_history for insert
  with check (auth.uid() = user_id);

create index if not exists idx_price_history_user_company on public.market_price_history(user_id, company_id);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
create table if not exists public.user_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  default_buying_brokerage_rate numeric(8, 6) default 0.005000 not null,
  default_selling_brokerage_rate numeric(8, 6) default 0.005000 not null,
  currency text default 'BDT' not null,
  timezone text default 'Asia/Dhaka' not null,
  theme text default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

create index if not exists idx_user_settings_user_id on public.user_settings(user_id);

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'companies') then
    alter publication supabase_realtime add table public.companies;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transactions') then
    alter publication supabase_realtime add table public.transactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'market_prices') then
    alter publication supabase_realtime add table public.market_prices;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'user_settings') then
    alter publication supabase_realtime add table public.user_settings;
  end if;
exception when others then
  null;
end $$;

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_companies_updated_at on public.companies;
create trigger update_companies_updated_at before update on public.companies
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_transactions_updated_at on public.transactions;
create trigger update_transactions_updated_at before update on public.transactions
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_market_prices_updated_at on public.market_prices;
create trigger update_market_prices_updated_at before update on public.market_prices
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_user_settings_updated_at on public.user_settings;
create trigger update_user_settings_updated_at before update on public.user_settings
  for each row execute procedure public.update_updated_at_column();
