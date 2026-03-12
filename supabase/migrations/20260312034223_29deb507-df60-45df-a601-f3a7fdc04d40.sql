
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS default_qty_morning numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_qty_evening numeric NOT NULL DEFAULT 0;
