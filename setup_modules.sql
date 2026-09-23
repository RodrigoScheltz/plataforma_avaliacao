-- 1. Criar a tabela de Módulos
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Atualizar a tabela question_bank
-- Adicionando a coluna 'type' que faltou
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Adicionando a relação com módulos
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.modules(id);

-- Removendo a coluna de texto livre antiga (se já existia)
ALTER TABLE public.question_bank DROP COLUMN IF EXISTS module;
