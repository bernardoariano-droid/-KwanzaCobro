import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authenticateRequest,
  getAdminSupabase,
  mapUtilizadorRow,
  normalizeServerRole,
  PRESERVED_SUPER_ADMIN_EMAIL,
  PRESERVED_SUPER_ADMIN_UUID,
} from '../_supabase.js';

function isProtectedSuperAdmin(userId?: string | null, email?: string | null): boolean {
  const cleanId = String(userId || '').trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  return (
    cleanId === PRESERVED_SUPER_ADMIN_UUID.toLowerCase() ||
    cleanEmail === PRESERVED_SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Constrói um payload adaptativo para public.utilizadores respeitando colunas existentes na tabela.
 */
function buildAdaptiveUtilizadorPayload(
  sampleColumns: Set<string>,
  input: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    companyId: string | null;
    isActive: boolean;
    branch?: string;
  },
  isInsert: boolean
): Record<string, any> {
  const payload: Record<string, any> = {};

  const has = (col: string) => sampleColumns.size === 0 || sampleColumns.has(col);

  if (isInsert) {
    payload.id = input.id;
    if (sampleColumns.has('auth_user_id')) payload.auth_user_id = input.id;
    if (sampleColumns.has('user_id')) payload.user_id = input.id;
  }

  if (has('email')) payload.email = input.email;

  if (sampleColumns.has('nome')) payload.nome = input.name;
  else if (has('name')) payload.name = input.name;

  if (sampleColumns.has('telefone')) payload.telefone = input.phone || '';
  else if (has('phone')) payload.phone = input.phone || '';

  if (sampleColumns.has('perfil')) payload.perfil = input.role;
  else if (has('role')) payload.role = input.role;

  if (has('company_id')) payload.company_id = input.companyId;

  if (sampleColumns.has('ativo')) payload.ativo = input.isActive;
  else if (sampleColumns.has('active')) payload.active = input.isActive;
  else if (sampleColumns.has('is_active')) payload.is_active = input.isActive;
  else if (sampleColumns.has('status')) payload.status = input.isActive ? 'ativo' : 'inativo';

  if (input.branch !== undefined) {
    if (sampleColumns.has('branch')) payload.branch = input.branch;
    else if (sampleColumns.has('filial')) payload.filial = input.branch;
  }

  if (sampleColumns.has('updated_at')) {
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

async function detectUtilizadoresColumns(adminSupabase: any): Promise<Set<string>> {
  try {
    const { data } = await adminSupabase.from('utilizadores').select('*').limit(1);
    if (Array.isArray(data) && data.length > 0) {
      return new Set(Object.keys(data[0]));
    }
  } catch {
    // fallback para conjunto padrão
  }
  return new Set(['id', 'email', 'nome', 'name', 'telefone', 'phone', 'role', 'company_id', 'ativo']);
}

async function insertOrUpdateUtilizadorWithFallback(
  adminSupabase: any,
  mode: 'insert' | 'update',
  targetId: string,
  payload: Record<string, any>
): Promise<{ data: any; error: any }> {
  let working = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    const query =
      mode === 'insert'
        ? adminSupabase.from('utilizadores').insert(working).select('*').maybeSingle()
        : adminSupabase.from('utilizadores').update(working).eq('id', targetId).select('*').maybeSingle();

    const { data, error } = await query;
    if (!error) return { data, error: null };

    const msg = String(error.message || '');
    const colMatch =
      msg.match(/column "([^"]+)" of relation "utilizadores" does not exist/i) ||
      msg.match(/Could not find the '([^']+)' column of 'utilizadores'/i);

    if (colMatch && colMatch[1] && colMatch[1] in working) {
      const missingCol = colMatch[1];
      const next = { ...working };
      delete next[missingCol];

      // Trocar sinónimos automaticamente quando uma coluna alternativa não existe
      if (missingCol === 'nome' && !('name' in next) && working.nome !== undefined) next.name = working.nome;
      if (missingCol === 'name' && !('nome' in next) && working.name !== undefined) next.nome = working.name;
      if (missingCol === 'telefone' && !('phone' in next) && working.telefone !== undefined) next.phone = working.telefone;
      if (missingCol === 'phone' && !('telefone' in next) && working.phone !== undefined) next.telefone = working.phone;
      if (missingCol === 'role' && !('perfil' in next) && working.role !== undefined) next.perfil = working.role;
      if (missingCol === 'perfil' && !('role' in next) && working.perfil !== undefined) next.role = working.perfil;
      if (missingCol === 'ativo' && !('status' in next) && working.ativo !== undefined) next.status = working.ativo ? 'ativo' : 'inativo';

      working = next;
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Não foi possível mapear as colunas de public.utilizadores.' } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const { profile: caller } = auth;

  // Apenas super_admin e admin_geral podem aceder à gestão de utilizadores
  if (caller.role !== 'super_admin' && caller.role !== 'admin_geral') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas Administradores Gerais ou Super Administrador podem gerir utilizadores.',
    });
  }

  let adminSupabase;
  try {
    adminSupabase = getAdminSupabase();
  } catch (envErr: any) {
    return res.status(500).json({
      success: false,
      error: envErr.message,
      missingServiceRoleKey: true,
    });
  }

  // -------------------------------------------------------
  // GET /api/admin/users - Listar utilizadores autorizados
  // -------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const requestedCompanyId = req.query?.companyId ? String(req.query.companyId) : null;
      let query = adminSupabase.from('utilizadores').select('*').order('created_at', { ascending: false });

      if (caller.role === 'admin_geral') {
        if (!caller.companyId) {
          return res.status(403).json({ success: false, error: 'Administrador sem empresa associada.' });
        }
        query = query.eq('company_id', caller.companyId);
      } else if (requestedCompanyId && requestedCompanyId !== 'all') {
        query = query.eq('company_id', requestedCompanyId);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      const users = (data || [])
        .map((row: any) => mapUtilizadorRow(row))
        // admin_geral nunca vê ou manipula contas super_admin
        .filter((u) => caller.role === 'super_admin' || u.role !== 'super_admin');

      return res.status(200).json({ success: true, users });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // -------------------------------------------------------
  // POST /api/admin/users - Criar utilizador em Auth + public.utilizadores
  // -------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const { name, email, password, phone, branch, role: rawRole, companyId: rawCompanyId } = req.body || {};

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanPass = String(password || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanBranch = String(branch || 'Sede').trim();
      const requestedRole = normalizeServerRole(rawRole);

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Informe um e-mail válido para o utilizador.' });
      }
      if (!cleanName) {
        return res.status(400).json({ success: false, error: 'Informe o nome completo do utilizador.' });
      }
      if (cleanPass.length < 6) {
        return res.status(400).json({ success: false, error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      }
      if (isProtectedSuperAdmin(null, cleanEmail)) {
        return res.status(403).json({
          success: false,
          error: 'O e-mail do Super Administrador principal é reservado e protegido.',
        });
      }

      // Validação de permissões por perfil
      if (caller.role === 'admin_geral') {
        if (requestedRole === 'super_admin') {
          return res.status(403).json({
            success: false,
            error: 'Um Administrador Geral não pode criar contas de Super Administrador.',
          });
        }
        if (rawCompanyId && caller.companyId && String(rawCompanyId) !== caller.companyId) {
          return res.status(403).json({
            success: false,
            error: 'Um Administrador Geral só pode cadastrar utilizadores na sua própria empresa.',
          });
        }
      }

      const resolvedCompanyId =
        caller.role === 'admin_geral'
          ? caller.companyId
          : requestedRole === 'super_admin'
          ? (rawCompanyId ? String(rawCompanyId) : null)
          : String(rawCompanyId || caller.companyId || 'default_company');

      if (requestedRole !== 'super_admin' && !resolvedCompanyId) {
        return res.status(400).json({ success: false, error: 'É obrigatório associar o utilizador a uma empresa.' });
      }

      // 1. Criar conta real no Supabase Auth
      const { data: createdAuth, error: authCreateErr } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPass,
        email_confirm: true,
        user_metadata: {
          name: cleanName,
          role: requestedRole,
          company_id: resolvedCompanyId,
        },
      });

      if (authCreateErr || !createdAuth?.user) {
        return res.status(400).json({
          success: false,
          error: authCreateErr?.message || 'Erro ao criar conta no Supabase Auth.',
        });
      }

      const newUid = createdAuth.user.id;
      const cols = await detectUtilizadoresColumns(adminSupabase);
      const utilPayload = buildAdaptiveUtilizadorPayload(
        cols,
        {
          id: newUid,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: requestedRole,
          companyId: resolvedCompanyId,
          isActive: true,
          branch: cleanBranch,
        },
        true
      );

      // 2. Registar perfil em public.utilizadores
      const { data: insertedRow, error: utilErr } = await insertOrUpdateUtilizadorWithFallback(
        adminSupabase,
        'insert',
        newUid,
        utilPayload
      );

      if (utilErr) {
        // Reverter criação no Auth para manter consistência transacional
        try {
          await adminSupabase.auth.admin.deleteUser(newUid);
        } catch {}
        return res.status(400).json({
          success: false,
          error: `Erro ao gravar em public.utilizadores: ${utilErr.message}`,
        });
      }

      // 3. Espelhar perfil comercial em public.sellers (sem guardar senha!) para manter FKs de dívidas/clientes
      if (resolvedCompanyId) {
        try {
          await adminSupabase
            .from('sellers')
            .upsert(
              {
                id: newUid,
                name: cleanName,
                phone: cleanPhone || '+244 900 000 000',
                branch: cleanBranch,
                email: cleanEmail,
                role: requestedRole,
                company_id: resolvedCompanyId,
              },
              { onConflict: 'id' }
            );
        } catch {}
      }

      const createdProfile = mapUtilizadorRow(insertedRow || utilPayload, createdAuth.user);
      return res.status(201).json({ success: true, user: createdProfile });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // -------------------------------------------------------
  // PATCH /api/admin/users - Atualizar utilizador / estado / permissões
  // -------------------------------------------------------
  if (req.method === 'PATCH') {
    try {
      const { userId, name, email, phone, branch, role: rawRole, companyId, isActive, password } = req.body || {};
      const targetId = String(userId || '').trim();

      if (!targetId) {
        return res.status(400).json({ success: false, error: 'userId é obrigatório.' });
      }

      const { data: existingRow, error: fetchErr } = await adminSupabase
        .from('utilizadores')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (fetchErr || !existingRow) {
        return res.status(404).json({ success: false, error: 'Utilizador não encontrado em public.utilizadores.' });
      }

      const targetProfile = mapUtilizadorRow(existingRow);

      // Proteger Super Administrador existente (bamidia@gmail.com / UUID 8b9f3c41-c996-4764-87c2-9d82411584e1)
      if (isProtectedSuperAdmin(targetProfile.id, targetProfile.email)) {
        return res.status(403).json({
          success: false,
          error: 'O Super Administrador principal está protegido e os seus dados não podem ser alterados.',
        });
      }

      // Regra estrita: Nenhum utilizador poderá alterar o próprio perfil, permissões ou empresa
      if (targetProfile.id === caller.id || targetProfile.authUserId === caller.authUserId) {
        const triesPrivilegeChange =
          (rawRole !== undefined && normalizeServerRole(rawRole) !== caller.role) ||
          (companyId !== undefined && String(companyId || '') !== String(caller.companyId || '')) ||
          (isActive !== undefined && Boolean(isActive) !== caller.isActive);

        if (triesPrivilegeChange) {
          return res.status(403).json({
            success: false,
            error: 'Nenhum utilizador pode alterar o próprio perfil, permissões ou empresa.',
          });
        }
      }

      // Isolamento por empresa para admin_geral
      if (caller.role === 'admin_geral') {
        if (targetProfile.role === 'super_admin') {
          return res.status(403).json({ success: false, error: 'Sem permissão para gerir Super Administradores.' });
        }
        if (String(targetProfile.companyId || '') !== String(caller.companyId || '')) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado: utilizador pertence a outra empresa.',
          });
        }
        if (rawRole !== undefined && normalizeServerRole(rawRole) === 'super_admin') {
          return res.status(403).json({
            success: false,
            error: 'Administrador Geral não pode promover utilizadores para Super Administrador.',
          });
        }
        if (companyId !== undefined && String(companyId || '') !== String(caller.companyId || '')) {
          return res.status(403).json({
            success: false,
            error: 'Administrador Geral não pode transferir utilizadores para outra empresa.',
          });
        }
      }

      const nextRole = rawRole !== undefined ? normalizeServerRole(rawRole) : targetProfile.role;
      const nextCompanyId =
        caller.role === 'admin_geral'
          ? caller.companyId
          : companyId !== undefined
          ? (companyId ? String(companyId) : null)
          : targetProfile.companyId;
      const nextIsActive = isActive !== undefined ? Boolean(isActive) : targetProfile.isActive;
      const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : targetProfile.email;
      const nextName = name !== undefined ? String(name).trim() : targetProfile.name;
      const nextPhone = phone !== undefined ? String(phone).trim() : targetProfile.phone;
      const nextBranch = branch !== undefined ? String(branch).trim() : targetProfile.branch;

      // Atualizar no Supabase Auth quando necessário
      const authUpdate: any = {
        user_metadata: {
          name: nextName,
          role: nextRole,
          company_id: nextCompanyId,
        },
        ban_duration: nextIsActive ? 'none' : '876000h',
      };
      if (nextEmail && nextEmail !== targetProfile.email) authUpdate.email = nextEmail;
      if (password && String(password).trim().length >= 6) authUpdate.password = String(password).trim();

      const authUidToUpdate = targetProfile.authUserId || targetProfile.id;
      const { error: authUpdErr } = await adminSupabase.auth.admin.updateUserById(authUidToUpdate, authUpdate);
      if (authUpdErr) {
        return res.status(400).json({
          success: false,
          error: `Erro ao atualizar autenticação no Supabase Auth: ${authUpdErr.message}`,
        });
      }

      const cols = await detectUtilizadoresColumns(adminSupabase);
      const utilUpdatePayload = buildAdaptiveUtilizadorPayload(
        cols,
        {
          id: targetProfile.id,
          name: nextName,
          email: nextEmail,
          phone: nextPhone,
          role: nextRole,
          companyId: nextCompanyId,
          isActive: nextIsActive,
          branch: nextBranch,
        },
        false
      );

      const { data: updatedRow, error: utilUpdErr } = await insertOrUpdateUtilizadorWithFallback(
        adminSupabase,
        'update',
        targetProfile.id,
        utilUpdatePayload
      );

      if (utilUpdErr) {
        return res.status(400).json({ success: false, error: utilUpdErr.message });
      }

      // Sincronizar tabela sellers caso exista
      if (nextCompanyId) {
        try {
          await adminSupabase
            .from('sellers')
            .upsert(
              {
                id: targetProfile.sellerId || targetProfile.id,
                name: nextName,
                phone: nextPhone || '+244 900 000 000',
                branch: nextBranch || 'Sede',
                email: nextEmail,
                role: nextRole,
                company_id: nextCompanyId,
              },
              { onConflict: 'id' }
            );
        } catch {}
      }

      return res.status(200).json({
        success: true,
        user: mapUtilizadorRow(updatedRow || { ...existingRow, ...utilUpdatePayload }),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // -------------------------------------------------------
  // DELETE /api/admin/users - Desativar ou remover utilizador
  // -------------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      const targetId = String(req.query?.userId || req.body?.userId || '').trim();
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'userId é obrigatório.' });
      }

      if (targetId === caller.id || targetId === caller.authUserId) {
        return res.status(403).json({ success: false, error: 'Não pode remover ou desativar a sua própria conta.' });
      }

      const { data: existingRow } = await adminSupabase
        .from('utilizadores')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (!existingRow) {
        return res.status(404).json({ success: false, error: 'Utilizador não encontrado.' });
      }

      const targetProfile = mapUtilizadorRow(existingRow);

      if (isProtectedSuperAdmin(targetProfile.id, targetProfile.email)) {
        return res.status(403).json({
          success: false,
          error: 'O Super Administrador principal não pode ser removido.',
        });
      }

      if (caller.role === 'admin_geral') {
        if (targetProfile.role === 'super_admin' || String(targetProfile.companyId || '') !== String(caller.companyId || '')) {
          return res.status(403).json({
            success: false,
            error: 'Sem permissão para remover utilizadores de outra empresa ou Super Administradores.',
          });
        }
      }

      // Desativar no Auth (ban) e remover/desativar perfil conforme integridade
      try {
        const delAuthRes = await adminSupabase.auth.admin.deleteUser(targetProfile.authUserId || targetProfile.id);
        if (delAuthRes.error) {
          await adminSupabase.auth.admin.updateUserById(targetProfile.authUserId || targetProfile.id, {
            ban_duration: '876000h',
          });
        }
      } catch {
        try {
          await adminSupabase.auth.admin.updateUserById(targetProfile.authUserId || targetProfile.id, {
            ban_duration: '876000h',
          });
        } catch {}
      }

      const { error: delErr } = await adminSupabase.from('utilizadores').delete().eq('id', targetProfile.id);
      if (delErr) {
        // Se existir FK histórica, desativa em vez de apagar
        const cols = await detectUtilizadoresColumns(adminSupabase);
        const disablePayload = buildAdaptiveUtilizadorPayload(
          cols,
          {
            id: targetProfile.id,
            name: targetProfile.name,
            email: targetProfile.email,
            phone: targetProfile.phone,
            role: targetProfile.role,
            companyId: targetProfile.companyId,
            isActive: false,
          },
          false
        );
        await insertOrUpdateUtilizadorWithFallback(adminSupabase, 'update', targetProfile.id, disablePayload);
        return res.status(200).json({ success: true, deactivatedOnly: true });
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Método não suportado.' });
}
