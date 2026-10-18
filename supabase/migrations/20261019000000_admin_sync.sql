-- ============================================
-- ADMIN ACCESS POLICIES & HELPER
-- ============================================
-- Allow service_role and backend queries to read/modify profiles, transactions, and companies without RLS blocks

-- Profiles: Allow public read/write if service_role or for admin endpoints
create policy "Allow read all profiles"
  on public.profiles for select
  using (true);

create policy "Allow admin update profiles"
  on public.profiles for update
  using (true);

create policy "Allow admin delete profiles"
  on public.profiles for delete
  using (true);

-- Transactions: Allow read/update/delete for admin operations
create policy "Allow read all transactions"
  on public.transactions for select
  using (true);

create policy "Allow admin update transactions"
  on public.transactions for update
  using (true);

create policy "Allow admin delete transactions"
  on public.transactions for delete
  using (true);

-- Companies: Allow read/update/delete for admin operations
create policy "Allow read all companies"
  on public.companies for select
  using (true);

create policy "Allow admin update companies"
  on public.companies for update
  using (true);

create policy "Allow admin delete companies"
  on public.companies for delete
  using (true);
