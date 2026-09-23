-- Execute este script caso o erro de criação de módulo persistir devido a restrições de segurança (RLS) do Supabase.

-- Garantir que a tabela modules permita operações (CRUD) para usuários anônimos/autenticados se RLS estiver ativo.
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura modules" ON public.modules;
CREATE POLICY "Permitir leitura modules" ON public.modules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao modules" ON public.modules;
CREATE POLICY "Permitir insercao modules" ON public.modules FOR INSERT WITH CHECK (true);

-- Garantir o mesmo para question_bank
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura question_bank" ON public.question_bank;
CREATE POLICY "Permitir leitura question_bank" ON public.question_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao question_bank" ON public.question_bank;
CREATE POLICY "Permitir insercao question_bank" ON public.question_bank FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir delete question_bank" ON public.question_bank;
CREATE POLICY "Permitir delete question_bank" ON public.question_bank FOR DELETE USING (true);
