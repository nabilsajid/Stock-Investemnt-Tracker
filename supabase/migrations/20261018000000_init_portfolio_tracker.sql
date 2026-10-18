-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Automatically created when a user signs up via Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- COMPANIES TABLE
-- ============================================
-- Each user has their own company entries (user-scoped, not global)
create type public.exchange_type as enum ('DSE', 'CSE');

create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  symbol text not null,
  exchange public.exchange_type not null default 'DSE',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Ensure unique company per user per exchange
  unique(user_id, symbol, exchange)
);

alter table public.companies enable row level security;

create policy "Users can view own companies"
  on public.companies for select
  using (auth.uid() = user_id);

create policy "Users can insert own companies"
  on public.companies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own companies"
  on public.companies for update
  using (auth.uid() = user_id);

create policy "Users can delete own companies"
  on public.companies for delete
  using (auth.uid() = user_id);

create index idx_companies_user_id on public.companies(user_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
-- The source of truth for all calculations
create type public.transaction_type as enum ('BUY', 'SELL');

create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  type public.transaction_type not null,
  date date not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  price_per_share numeric(18, 4) not null check (price_per_share > 0),
  gross_amount numeric(18, 4) not null, -- quantity * price_per_share
  brokerage_rate numeric(8, 6) not null default 0.005000,
  brokerage_amount numeric(18, 4) not null, -- gross_amount * brokerage_rate
  net_amount numeric(18, 4) not null, -- For BUY: gross + brokerage; For SELL: gross - brokerage
  -- Sale-specific fields (null for purchases)
  cost_basis_of_sold numeric(18, 4), -- quantity * avg cost at time of sale
  realized_profit_loss numeric(18, 4), -- net_amount - cost_basis_of_sold
  pre_sale_avg_cost numeric(18, 4), -- weighted avg cost before this sale
  -- Optional extra charges
  additional_charges numeric(18, 4) default 0,
  additional_charges_note text,
  -- Metadata
  notes text,
  sequence integer default 0, -- for ordering same-day transactions
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

create index idx_transactions_user_company on public.transactions(user_id, company_id);
create index idx_transactions_user_date on public.transactions(user_id, date);
create index idx_transactions_company_date on public.transactions(company_id, date, sequence);

-- ============================================
-- MARKET PRICES TABLE
-- ============================================
-- Stores manually entered current market prices
create table public.market_prices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  price numeric(18, 4) not null check (price > 0),
  updated_at timestamptz default now() not null,
  
  -- One active price per company per user
  unique(user_id, company_id)
);

alter table public.market_prices enable row level security;

create policy "Users can view own market prices"
  on public.market_prices for select
  using (auth.uid() = user_id);

create policy "Users can insert own market prices"
  on public.market_prices for insert
  with check (auth.uid() = user_id);

create policy "Users can update own market prices"
  on public.market_prices for update
  using (auth.uid() = user_id);

create policy "Users can delete own market prices"
  on public.market_prices for delete
  using (auth.uid() = user_id);

create index idx_market_prices_user_company on public.market_prices(user_id, company_id);

-- ============================================
-- MARKET PRICE HISTORY TABLE
-- ============================================
create table public.market_price_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  price numeric(18, 4) not null check (price > 0),
  recorded_at timestamptz default now() not null
);

alter table public.market_price_history enable row level security;

create policy "Users can view own price history"
  on public.market_price_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own price history"
  on public.market_price_history for insert
  with check (auth.uid() = user_id);

create index idx_price_history_user_company on public.market_price_history(user_id, company_id);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
create table public.user_settings (
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

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

create index idx_user_settings_user_id on public.user_settings(user_id);

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.market_prices;
alter publication supabase_realtime add table public.user_settings;

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

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_companies_updated_at before update on public.companies
  for each row execute procedure public.update_updated_at_column();

create trigger update_transactions_updated_at before update on public.transactions
  for each row execute procedure public.update_updated_at_column();

create trigger update_market_prices_updated_at before update on public.market_prices
  for each row execute procedure public.update_updated_at_column();

create trigger update_user_settings_updated_at before update on public.user_settings
  for each row execute procedure public.update_updated_at_column();
