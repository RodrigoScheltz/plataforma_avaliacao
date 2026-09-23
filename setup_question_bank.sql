-- Script para criar a tabela de Banco de Questões (question_bank)
-- Execute este script no SQL Editor do seu Supabase.

CREATE TABLE IF NOT EXISTS public.question_bank (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module VARCHAR(255) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
