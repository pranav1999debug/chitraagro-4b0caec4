
-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  default_qty NUMERIC NOT NULL DEFAULT 0,
  default_rate NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT USING (is_farm_member(auth.uid(), farm_id));
CREATE POLICY "Owner/Manager can add suppliers" ON public.suppliers FOR INSERT WITH CHECK (has_farm_role(auth.uid(), farm_id, 'owner') OR has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner/Manager can update suppliers" ON public.suppliers FOR UPDATE USING (has_farm_role(auth.uid(), farm_id, 'owner') OR has_farm_role(auth.uid(), farm_id, 'manager'));
CREATE POLICY "Owner can delete suppliers" ON public.suppliers FOR DELETE USING (has_farm_role(auth.uid(), farm_id, 'owner'));

-- Add supplier_id to procurement (optional reference, keep supplier_name for backward compat)
ALTER TABLE public.procurement ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
