# NEUROJUS — configuração da migração para Supabase Auth

## O que esta migração faz
- Mantém as tabelas comerciais existentes e não apaga clientes, dívidas, pagamentos ou funcionários.
- Cria `user_profiles`, ligada a `auth.users`, para guardar o papel real de cada utilizador.
- Associa por e-mail as contas Auth que já existirem aos registos de `sellers`; essas associações começam como vendedor.
- Remove políticas RLS antigas permissivas e instala regras para administrador e vendedor.
- Retira o acesso anónimo às tabelas protegidas.
- Desactiva os gatilhos antigos que copiavam palavras-passe em texto simples para o snapshot.
- Remove palavras-passe do snapshot existente, sem apagar o snapshot nem os dados relacionais.

## Estado do código no ramo de trabalho
O formulário de login já usa `supabase.auth.signInWithPassword`, a recuperação usa `resetPasswordForEmail`, a aplicação restaura e termina sessões Supabase Auth, e o perfil `user_profiles` determina a função do utilizador. As rotas `/api/supabase/pull`, `/api/supabase/sync`, `/api/data` e `/api/supabase/status` validam o JWT e consultam o perfil; a sincronização integral é reservada ao administrador. O endpoint `/api/admin/users` provisiona contas Auth e registos de vendedor apenas após validar um administrador.

**Ainda não executar o SQL nem publicar como produção.** O código está no ramo de trabalho, mas não foi possível executar build, testes automatizados ou testes contra o projecto Supabase real. Primeiro é necessário rever e aplicar a migração no Supabase, configurar as variáveis Vercel e testar com contas reais de administrador e vendedor.

## Preparação necessária antes da execução
1. Faça uma cópia de segurança da base de dados.
2. Confirme que está no projecto Supabase correcto.
3. Não partilhe a chave `service_role` nem a palavra-passe aqui no ChatGPT.
4. Adicione `SUPABASE_SERVICE_ROLE_KEY` apenas às variáveis privadas do projecto Vercel (Production, Preview e Development conforme necessário); nunca a coloque em `VITE_`.
5. A conta Auth do administrador será criada em Authentication → Users antes da execução do SQL.

## Activação do administrador (apenas depois de executar a migração)
1. Copie o UUID do administrador em Authentication → Users.
2. No SQL Editor, execute, substituindo os valores:
   ```sql
   insert into public.user_profiles (user_id, full_name, role)
   values ('UUID-REAL-DO-ADMIN', 'Administrador Geral', 'admin');
   ```
3. Confirme que a linha aparece em `public.user_profiles` com `role = 'admin'`.
4. Crie contas Auth dos vendedores com o mesmo e-mail que consta em `public.sellers.email`. A migração associa automaticamente esses utilizadores aos registos existentes como vendedor.
5. Configure SMTP em Authentication → SMTP Settings para recuperação de palavra-passe.

## Variáveis de ambiente
Frontend (Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Apenas no servidor Vercel, nunca com prefixo VITE_:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

A chave `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser colocada no código frontend, no GitHub ou enviada no chat.

## Atenção: esta é a migração da camada de identidade e das políticas RLS
Antes de produção, valide os endpoints e o isolamento de dados com duas contas reais (administrador e vendedor), confirme que o vendedor não consegue consultar nem alterar dados de outros vendedores e confirme o fluxo de recuperação de senha. A sincronização antiga por snapshot foi restringida a administrador; a aplicação usa também operações directas do cliente Supabase, sujeitas a RLS.

As palavras-passe antigas guardadas nas colunas `sellers.password`, `company_settings.senha` e `company_settings.password` não podem ser importadas como credenciais Auth. Os utilizadores devem activar as contas e definir novas palavras-passe. Não elimine essas colunas nesta fase; primeiro conclua a activação e valide a aplicação.
