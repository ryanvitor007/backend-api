const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = new Client({
    connectionString: "postgresql://postgres:[Avianca1020]@db.kjavukhdmmhnkoqoeqpn.supabase.co:5432/postgres"
  });
  
  try {
    await client.connect();
    
    // Check if admin exists
    const checkAdmin = await client.query("SELECT * FROM employees WHERE email = 'admin@trl.com'");
    
    if (checkAdmin.rows.length === 0) {
      const adminPass = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO employees (name, cpf, email, password, role, active)
        VALUES ('Administrador Geral', '00000000000', 'admin@trl.com', $1, 'Admin', true)
      `, [adminPass]);
      console.log('✅ Usuário Administrador criado: admin@trl.com / admin123');
    } else {
      console.log('ℹ️ Administrador já existe no banco.');
    }

    // Check if motorista exists
    const checkMotorista = await client.query("SELECT * FROM employees WHERE email = 'motorista@trl.com'");
    if (checkMotorista.rows.length === 0) {
      const motoristaPass = await bcrypt.hash('motorista123', 10);
      await client.query(`
        INSERT INTO employees (name, cpf, email, password, role, active)
        VALUES ('João Motorista', '11111111111', 'motorista@trl.com', $1, 'Motorista', true)
      `, [motoristaPass]);
      console.log('✅ Usuário Motorista criado: motorista@trl.com / motorista123');
    } else {
      console.log('ℹ️ Motorista já existe no banco.');
    }
    
  } catch (err) {
    console.error('Erro ao conectar ou inserir:', err);
  } finally {
    await client.end();
  }
}

seed();
