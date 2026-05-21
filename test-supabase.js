const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://kjavukhdmmhnkoqoeqpn.supabase.co',
  'sb_publishable_725JuPEUY4o6o0nlzBcfaQ_kHT9RyeH'
);

async function run() {
  console.log('Buscando usuarios...');
  
  const { data, error } = await supabase.from('employees').select('id, name, email, role');
  if (error) console.error(error);
  console.log('Usuarios no banco:', data);
  
  if (data && data.length > 0) {
    const adminPass = await bcrypt.hash('admin123', 10);
    const motoristaPass = await bcrypt.hash('motorista123', 10);
    
    await supabase.from('employees').update({ password: adminPass }).in('email', ['admin@trl.com', 'ryan.vitor@trl.com']);
    await supabase.from('employees').update({ password: motoristaPass }).in('email', ['joao@trl.com', 'ryan.santos@trl.com']);
      
    console.log('Senhas atualizadas: Todos os admins são admin123 e motoristas são motorista123');
  }
}

run();
