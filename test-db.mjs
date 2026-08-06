import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('users').insert({
    name: 'Gestor',
    email: 'admin@teste.com',
    password: '123',
    role: 'EVALUATOR',
    profile: 'Gestor',
    level: 'Sênior'
  }).select();
  
  if (error) {
    console.error('INSERT ERROR:', error);
  } else {
    console.log('INSERT SUCCESS:', data);
  }
}

test();
