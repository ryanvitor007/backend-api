const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function test() {
  console.log('=== INICIANDO TESTES DO BACKEND EVOLUÍDO ===\n');

  let accessToken = '';
  let refreshToken = '';

  // 1. Testar Login
  console.log('[1/5] Testando POST /auth/login...');
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'ryan.vitor@trl.com',
      password: 'admin123'
    }, {
      headers: { 'User-Agent': 'NodeTestAgent/1.0' }
    });

    accessToken = loginRes.data.access_token;
    refreshToken = loginRes.data.refresh_token;

    console.log('  ? Login com sucesso!');
    console.log(`  Access Token (abreviado): ${accessToken.substring(0, 30)}...`);
    console.log(`  Refresh Token (abreviado): ${refreshToken.substring(0, 30)}...`);
    console.log(`  Dispositivo mapeado: ${loginRes.data.user?.role}\n`);
  } catch (err) {
    console.error('  ? Erro no login:', err.response?.data || err.message);
    return;
  }

  // 2. Testar Refresh Token Rotation
  console.log('[2/5] Testando rotação de Refresh Token (POST /auth/refresh)...');
  try {
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken
    }, {
      headers: { 'User-Agent': 'NodeTestAgent/2.0' }
    });

    // Atualiza com os novos tokens rotacionados
    accessToken = refreshRes.data.access_token;
    refreshToken = refreshRes.data.refresh_token;

    console.log('  ? Rotação de token efetuada com sucesso!');
    console.log(`  Novo Access Token: ${accessToken.substring(0, 30)}...\n`);
  } catch (err) {
    console.error('  ? Erro na rotação de token:', err.response?.data || err.message);
  }

  // 3. Testar GET /dashboard
  console.log('[3/5] Testando GET /dashboard (Requer permissões e JWT)...');
  try {
    const dashboardRes = await axios.get(`${BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log('  ? Dashboard carregado com sucesso!');
    console.log('  Métricas agregadas (KPIs):', dashboardRes.data.kpis);
    console.log('  Métricas de Gráficos:', dashboardRes.data.charts, '\n');
  } catch (err) {
    console.error('  ? Erro ao buscar dashboard:', err.response?.data || err.message);
  }

  // 4. Testar GET /drivers
  console.log('[4/5] Testando GET /drivers (Filtro e listagem)...');
  try {
    const driversRes = await axios.get(`${BASE_URL}/drivers?limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log('  ? Lista de motoristas carregada!');
    console.log(`  Total no banco: ${driversRes.data.total}`);
    console.log('  Primeiros resultados:', driversRes.data.data.map(d => `${d.name} (${d.active ? 'Ativo' : 'Inativo'})`), '\n');
  } catch (err) {
    console.error('  ? Erro ao buscar motoristas:', err.response?.data || err.message);
  }

  // 5. Testar Rate Limiting no Login
  console.log('[5/5] Testando Rate Limiting (disparando 6 requisições de login rápidas)...');
  let rateLimited = false;
  for (let i = 0; i < 6; i++) {
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'ryan.vitor@trl.com',
        password: 'admin123'
      });
    } catch (err) {
      if (err.response?.status === 429) {
        rateLimited = true;
        console.log(`  ? Bloqueio de Rate Limiting ativado: 429 Too Many Requests (Requisição ${i + 1})\n`);
        break;
      }
    }
  }
  if (!rateLimited) {
    console.log('  ?? Não foi bloqueado por Rate Limiting. Certifique-se de que o ThrottlerGuard está ativo e verifique as configurações.\n');
  }

  console.log('=== TESTES FINALIZADOS ===');
}

test();
