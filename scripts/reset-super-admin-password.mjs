import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente de .env e .env.local (se existirem) sem expor segredos
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: false });
}

const SUPER_ADMIN_EMAIL = 'bamidia@gmail.com';
const SUPER_ADMIN_UUID = '8b9f3c41-c996-4764-87c2-9d82411584e1';

function sanitizeSupabaseUrl(rawUrl) {
  return String(rawUrl || '')
    .trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

async function main() {
  const supabaseUrl = sanitizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const newPassword = String(process.env.NEW_ADMIN_PASSWORD || '');

  // 1. Verificar variáveis de ambiente obrigatórias antes de qualquer operação
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!newPassword) missingVars.push('NEW_ADMIN_PASSWORD');

  if (missingVars.length > 0) {
    console.error(
      `[ERRO] Variáveis de ambiente em falta: ${missingVars.join(', ')}.\n` +
        'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e NEW_ADMIN_PASSWORD no .env ou na linha de comandos antes de executar.'
    );
    process.exit(1);
  }

  if (!/^https?:\/\//i.test(supabaseUrl)) {
    console.error('[ERRO] SUPABASE_URL inválida. Deve iniciar com https:// ou http://.');
    process.exit(1);
  }

  if (newPassword.trim().length < 6) {
    console.error('[ERRO] NEW_ADMIN_PASSWORD deve ter pelo menos 6 caracteres.');
    process.exit(1);
  }

  // 2. Inicializar cliente administrativo Supabase exclusivamente no backend/script local
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 3. Confirmar que a conta alvo existe e corresponde exactamente ao UUID e Email esperados
  const { data: existingAuth, error: getErr } = await supabase.auth.admin.getUserById(SUPER_ADMIN_UUID);
  if (getErr || !existingAuth?.user) {
    console.error(
      `[ERRO] Não foi possível localizar a conta no Supabase Auth para UUID ${SUPER_ADMIN_UUID}: ${
        getErr?.message || 'Utilizador não encontrado.'
      }`
    );
    process.exit(1);
  }

  const currentEmail = String(existingAuth.user.email || '').trim().toLowerCase();
  if (currentEmail !== SUPER_ADMIN_EMAIL) {
    console.error(
      `[ERRO] O UUID ${SUPER_ADMIN_UUID} pertence ao e-mail "${currentEmail}" e não a "${SUPER_ADMIN_EMAIL}". Operação cancelada por segurança.`
    );
    process.exit(1);
  }

  // 4. Verificação apenas de leitura do perfil em public.utilizadores (preserva todos os dados e colunas)
  const { data: profileRow, error: profileErr } = await supabase
    .from('utilizadores')
    .select('*')
    .eq('id', SUPER_ADMIN_UUID)
    .maybeSingle();

  if (profileErr) {
    console.error(`[ERRO] Falha ao consultar public.utilizadores: ${profileErr.message}`);
    process.exit(1);
  }

  if (!profileRow) {
    console.error(
      `[ERRO] Perfil não encontrado em public.utilizadores para o UUID ${SUPER_ADMIN_UUID}. Nenhum registo foi alterado.`
    );
    process.exit(1);
  }

  const resolvedRole = String(profileRow.role ?? profileRow.perfil ?? '').trim().toLowerCase();
  if (resolvedRole !== 'super_admin' && resolvedRole !== 'superadmin') {
    console.error(
      `[ERRO] O perfil encontrado em public.utilizadores ("${resolvedRole}") não é super_admin. Operação cancelada.`
    );
    process.exit(1);
  }

  // 5. Actualizar apenas a palavra-passe via Supabase Auth Admin API (sem alterar email, UUID, perfil, empresa ou RLS)
  const { data: updatedAuth, error: updateErr } = await supabase.auth.admin.updateUserById(
    SUPER_ADMIN_UUID,
    { password: newPassword }
  );

  if (updateErr || !updatedAuth?.user) {
    console.error(
      `[ERRO] Falha ao actualizar palavra-passe no Supabase Auth: ${updateErr?.message || 'Erro desconhecido.'}`
    );
    process.exit(1);
  }

  if (
    updatedAuth.user.id !== SUPER_ADMIN_UUID ||
    String(updatedAuth.user.email || '').trim().toLowerCase() !== SUPER_ADMIN_EMAIL
  ) {
    console.error('[ERRO] Divergência inesperada na resposta do Supabase Auth após actualização.');
    process.exit(1);
  }

  console.log('[SUCESSO] Palavra-passe do Super Administrador actualizada no Supabase Auth.');
  console.log(`Conta confirmada: ${updatedAuth.user.email}`);
  console.log(`UUID preservado: ${updatedAuth.user.id}`);
  console.log(`Perfil preservado: ${resolvedRole}`);
}

main().catch((err) => {
  console.error('[ERRO FATAL]', err?.message || err);
  process.exit(1);
});
