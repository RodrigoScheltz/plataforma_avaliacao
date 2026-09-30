-- Execute este script no SQL Editor do Supabase para adicionar a flag de redefinição de senha obrigatória
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
