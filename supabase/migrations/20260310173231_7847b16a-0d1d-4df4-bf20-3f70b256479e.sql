
-- UTILITY: updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ROLES ENUM
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

-- FARMS
CREATE TABLE public.farms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Dairy Farm',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  active_farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- FARM MEMBERS
CREATE TABLE public.farm_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farm_id, user_id)
);
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

-- FARM INVITES
CREATE TABLE public.farm_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role app_role NOT NULL DEFAULT 'staff',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_uses INT DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.farm_invites ENABLE ROW LEVEL SECURITY;

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  purchase_rate NUMERIC NOT NULL DEFAULT 0,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  time_group TEXT NOT NULL DEFAULT 'both' CHECK (time_group IN ('morning', 'evening', 'both')),
  milk_type TEXT NOT NULL DEFAULT 'cow' CHECK (milk_type IN ('cow', 'buffalo', 'mixed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  time_group TEXT NOT NULL CHECK (time_group IN ('morning', 'evening')),
  quantity NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  mila NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- STAFF
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  salary NUMERIC NOT NULL DEFAULT 0,
  advance NUMERIC NOT NULL DEFAULT 0,
  join_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- ATTENDANCE
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date_key)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  sub_category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  date_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- PROCUREMENT
CREATE TABLE public.procurement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  date_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.procurement ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_farm_member(_user_id UUID, _farm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.farm_members WHERE user_id = _user_id AND farm_id = _farm_id)
$$;

CREATE OR REPLACE FUNCTION public.has_farm_role(_user_id UUID, _farm_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.farm_members WHERE user_id = _user_id AND farm_id = _farm_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_farm_role(_user_id UUID, _farm_id UUID)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.farm_members WHERE user_id = _user_id AND farm_id = _farm_id LIMIT 1
$$;

-- RLS: FARMS
CREATE POLICY "Members can view their farms" ON public.farms FOR SELECT USING (public.is_farm_member(auth.uid(), id));
CREATE POLICY "Owners can update their farms" ON public.farms FOR UPDATE USING (public.has_farm_role(auth.uid(), id, 'owner'));
CREATE POLICY "Auth users can create farms" ON public.farms FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their farms" ON public.farms FOR DELETE USING (public.has_farm_role(auth.uid(), id, 'owner'));

-- RLS: PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS: FARM_MEMBERS
CREATE POLICY "Members can view farm members" ON public.farm_members FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owners can add farm members" ON public.farm_members FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR auth.uid() = user_id);
CREATE POLICY "Owners can remove farm members" ON public.farm_members FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: FARM_INVITES
CREATE POLICY "Anyone auth can read invites" ON public.farm_invites FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owners can create invites" ON public.farm_invites FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner'));
CREATE POLICY "Owners can delete invites" ON public.farm_invites FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));
CREATE POLICY "Anyone can update invite count" ON public.farm_invites FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS: CUSTOMERS
CREATE POLICY "Members can view customers" ON public.customers FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add customers" ON public.customers FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update customers" ON public.customers FOR UPDATE USING (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete customers" ON public.customers FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: TRANSACTIONS
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add transactions" ON public.transactions FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update transactions" ON public.transactions FOR UPDATE USING (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete transactions" ON public.transactions FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: PAYMENTS
CREATE POLICY "Members can view payments" ON public.payments FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add payments" ON public.payments FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete payments" ON public.payments FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: STAFF
CREATE POLICY "Members can view staff" ON public.staff FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add staff" ON public.staff FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update staff" ON public.staff FOR UPDATE USING (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete staff" ON public.staff FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: ATTENDANCE
CREATE POLICY "Members can view attendance" ON public.attendance FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add attendance" ON public.attendance FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update attendance" ON public.attendance FOR UPDATE USING (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));

-- RLS: EXPENSES
CREATE POLICY "Members can view expenses" ON public.expenses FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add expenses" ON public.expenses FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update expenses" ON public.expenses FOR UPDATE USING (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete expenses" ON public.expenses FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- RLS: PROCUREMENT
CREATE POLICY "Members can view procurement" ON public.procurement FOR SELECT USING (public.is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add procurement" ON public.procurement FOR INSERT WITH CHECK (public.has_farm_role(auth.uid(), farm_id, 'owner') OR public.has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete procurement" ON public.procurement FOR DELETE USING (public.has_farm_role(auth.uid(), farm_id, 'owner'));

-- TRIGGERS
CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON public.farms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO-CREATE PROFILE + FARM ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_farm_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.farms (name, owner_id) VALUES ('My Dairy Farm', NEW.id) RETURNING id INTO new_farm_id;
  INSERT INTO public.farm_members (farm_id, user_id, role) VALUES (new_farm_id, NEW.id, 'owner');
  UPDATE public.profiles SET active_farm_id = new_farm_id WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- JOIN FARM VIA INVITE
CREATE OR REPLACE FUNCTION public.join_farm_by_invite(_invite_code TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

  SELECT * INTO _invite FROM public.farm_invites WHERE invite_code = _invite_code AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR used_count < max_uses);
  IF NOT FOUND THEN RETURN json_build_object('error', 'Invalid or expired invite'); END IF;

  IF EXISTS (SELECT 1 FROM public.farm_members WHERE farm_id = _invite.farm_id AND user_id = _user_id) THEN
    RETURN json_build_object('error', 'Already a member', 'farm_id', _invite.farm_id);
  END IF;

  INSERT INTO public.farm_members (farm_id, user_id, role) VALUES (_invite.farm_id, _user_id, _invite.role);
  UPDATE public.farm_invites SET used_count = used_count + 1 WHERE id = _invite.id;
  UPDATE public.profiles SET active_farm_id = _invite.farm_id WHERE user_id = _user_id;

  RETURN json_build_object('success', true, 'farm_id', _invite.farm_id);
END;
$$;

-- INDEXES
CREATE INDEX idx_farm_members_user ON public.farm_members(user_id);
CREATE INDEX idx_farm_members_farm ON public.farm_members(farm_id);
CREATE INDEX idx_customers_farm ON public.customers(farm_id);
CREATE INDEX idx_transactions_farm_date ON public.transactions(farm_id, date_key);
CREATE INDEX idx_payments_farm_customer ON public.payments(farm_id, customer_id);
CREATE INDEX idx_staff_farm ON public.staff(farm_id);
CREATE INDEX idx_attendance_staff_date ON public.attendance(staff_id, date_key);
CREATE INDEX idx_expenses_farm_date ON public.expenses(farm_id, date_key);
CREATE INDEX idx_procurement_farm_date ON public.procurement(farm_id, date_key);
CREATE INDEX idx_farm_invites_code ON public.farm_invites(invite_code);
