import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  PRESERVED_SUPER_ADMIN_EMAIL,
  PRESERVED_SUPER_ADMIN_UUID,
  sanitizeSupabaseUrl,
} from '../_supabase.js';

const TARGET_UUID = PRESERVED_SUPER_ADMIN_UUID; // 8b9f3c41-c996-4764-87c2-9d82411584e1
const TARGET_EMAIL = PRESERVED_SUPER_ADMIN_EMAIL; // bamidia@gmail.com

function isTempEndpointDisabled(): boolean {
  return String(process.env.ENABLE_TEMP_SUPER_ADMIN_RESET || '').trim().toLowerCase() === 'false';
}

function constantTimeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function getServerSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseUrl = rawUrl ? sanitizeSupabaseUrl(rawUrl) : '';
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const resetToken = String(process.env.SUPER_ADMIN_RESET_TOKEN || '').trim();
  return { supabaseUrl, serviceRoleKey, resetToken };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (isTempEndpointDisabled()) {
    return res.status(410).json({
      success: false,
      disabled: true,
      error: 'Esta função administrativa temporária foi desativada.',
    });
  }

  const { supabaseUrl, serviceRoleKey, resetToken } = getServerSupabaseConfig();

  // GET: Verifica apenas estado operacional do endpoint (nunca devolve chaves nem tokens)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      enabled: true,
      targetUuid: TARGET_UUID,
      targetEmail: TARGET_EMAIL,
      targetRole: 'super_admin',
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasResetToken: Boolean(resetToken && resetToken.length >= 16),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        success: false,
        missingEnv: true,
        error:
          'Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão configuradas nas variáveis de ambiente do servidor (Vercel).',
      });
    }

    // 1. Autenticar e autorizar rigorosamente o administrador que solicita a operação
    let authorizedBy: 'jwt_super_admin' | 'server_reset_token' | null = null;
    const authHeader = req.headers?.authorization || req.headers?.Authorization;

    if (authHeader && typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)) {
      const auth = await authenticateRequest(req);
      if (!auth.ok) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
      if (auth.profile.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Apenas o Super Administrador autenticado pode executar esta operação.',
        });
      }
      authorizedBy = 'jwt_super_admin';
    } else {
      const providedToken = String(
        req.headers?.['x-reset-token'] ||
          req.headers?.['X-Reset-Token'] ||
          req.body?.setupToken ||
          ''
      ).trim();

      if (!resetToken || resetToken.length < 16) {
        return res.status(401).json({
          success: false,
          error:
            'Autenticação obrigatória. Inicie sessão como Super Administrador ou configure SUPER_ADMIN_RESET_TOKEN (mínimo 16 caracteres) nas variáveis de ambiente do servidor.',
        });
      }

      if (!providedToken || !constantTimeMatch(providedToken, resetToken)) {
        return res.status(403).json({
          success: false,
          error: 'Token de autorização administrativa inválido ou em falta.',
        });
      }

      authorizedBy = 'server_reset_token';
    }

    // 2. Validar nova palavra-passe sem a registar em logs ou base de dados pública
    const rawNewPassword = req.body?.newPassword;
    const newPassword = typeof rawNewPassword === 'string' ? rawNewPassword : '';

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.',
      });
    }

    // 3. Cliente administrativo exclusivamente com SERVICE_ROLE no servidor
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 4. Confirmar que o UUID alvo existe no Supabase Auth e pertence a bamidia@gmail.com
    const { data: existingAuth, error: getAuthErr } = await adminSupabase.auth.admin.getUserById(TARGET_UUID);
    if (getAuthErr || !existingAuth?.user) {
      return res.status(404).json({
        success: false,
        error: `Conta Super Admin não encontrada no Supabase Auth para UUID ${TARGET_UUID}: ${
          getAuthErr?.message || 'Utilizador inexistente.'
        }`,
      });
    }

    const authEmail = String(existingAuth.user.email || '').trim().toLowerCase();
    if (authEmail !== TARGET_EMAIL) {
      return res.status(409).json({
        success: false,
        error: `Divergência de segurança: o UUID ${TARGET_UUID} está associado a outro e-mail.`,
      });
    }

    // 5. Verificação apenas de leitura em public.utilizadores (sem alterar colunas, perfil ou políticas RLS)
    const { data: utilRow, error: utilErr } = await adminSupabase
      .from('utilizadores')
      .select('*')
      .eq('id', TARGET_UUID)
      .maybeSingle();

    if (utilErr) {
      return res.status(400).json({
        success: false,
        error: `Erro ao verificar perfil em public.utilizadores: ${utilErr.message}`,
      });
    }

    if (!utilRow) {
      return res.status(404).json({
        success: false,
        error: `Perfil em public.utilizadores não encontrado para UUID ${TARGET_UUID}.`,
      });
    }

    const resolvedRole = String(utilRow.role ?? utilRow.perfil ?? '').trim().toLowerCase();
    if (resolvedRole !== 'super_admin' && resolvedRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: `O perfil atual (${resolvedRole || 'desconhecido'}) não é super_admin. Operação cancelada.`,
      });
    }

    // 6. Atualizar exclusivamente a palavra-passe da conta existente via Auth Admin API
    const { data: updatedAuth, error: updateErr } = await adminSupabase.auth.admin.updateUserById(TARGET_UUID, {
      password: newPassword,
    });

    if (updateErr || !updatedAuth?.user) {
      return res.status(400).json({
        success: false,
        error: `Falha ao atualizar palavra-passe no Supabase Auth: ${updateErr?.message || 'Erro desconhecido.'}`,
      });
    }

    if (
      updatedAuth.user.id !== TARGET_UUID ||
      String(updatedAuth.user.email || '').trim().toLowerCase() !== TARGET_EMAIL
    ) {
      return res.status(500).json({
        success: false,
        error: 'Resposta inesperada do Supabase Auth ao confirmar a conta atualizada.',
      });
    }

    return res.status(200).json({
      success: true,
      confirmedBySupabase: true,
      authorizedBy,
      email: updatedAuth.user.email,
      uuid: updatedAuth.user.id,
      role: 'super_admin',
      message: `Palavra-passe confirmada e atualizada no Supabase Auth para ${updatedAuth.user.email}.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro interno ao atualizar palavra-passe do Super Administrador.',
    });
  }
}
