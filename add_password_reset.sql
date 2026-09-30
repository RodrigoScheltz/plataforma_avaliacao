-- 1. Cria a coluna caso ela não exista
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- 2. Concede permissão de SELECT e UPDATE na nova coluna para acesso público (anon)
GRANT SELECT (must_change_password) ON public.users TO anon;
GRANT UPDATE (must_change_password) ON public.users TO anon;

-- 3. Cria uma função segura (RPC) para checar a senha ignorando bloqueios de permissão da tabela
CREATE OR REPLACE FUNCTION check_must_change_password(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_must boolean;
BEGIN
  SELECT must_change_password INTO v_must FROM public.users WHERE id = p_user_id;
  RETURN COALESCE(v_must, false);
END;
$$;
