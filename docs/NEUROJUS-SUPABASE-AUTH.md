# NEUROJUS — configuração da migração para Supabase Auth

## O que esta migração faz
- Mantém as tabelas comerciais existentes e não apaga clientes, dívidas, pagamentos ou funcionários.
- Cria `user_profiles`, ligada a `auth.users`, para guardar o papel real de cada utilizador.
- Associa por e-mail as contas Auth que já existirem aos registos de `sellers`; essas associações começam como vendedor.
- Remove políticas RLS antigas permissivas e instala regras para administrador e vendedor.
- Retira o acesso anónimo às tabelas protegidas.
- Desactiva os gatilhos antigos que copiavam palavras-passe em texto simples para o snapshot.
- Remove palavras-passe do snapshot existente, sem apagar o snapshot nem os dados relacionais.

## Antes de executar
1. Faça uma cópia de segurança da base de dados.
2. No Supabase, abra **Authentication → Users** e crie primeiro a conta do administrador com e-mail e palavra-passe fortes.
3. Não partilhe a chave `service_role` nem a palavra-passe aqui no ChatGPT.
4. Execute o ficheiro `supabase-auth-migration.sql` no **SQL Editor** do projecto correcto.

## Depois de executar
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
A aplicação ainda precisa de concluir a integração do fluxo de login/logout com `supabase.auth`, carregar o perfil autenticado antes de consultar os dados e substituir as rotas antigas de sincronização por endpoints que validem o JWT e o papel no servidor. Não considere o sistema pronto para produção até esses passos e os testes com duas contas (administrador e vendedor) estarem concluídos.

As palavras-passe antigas guardadas nas colunas `sellers.password`, `company_settings.senha` e `company_settings.password` não podem ser importadas como credenciais Auth. Os utilizadores devem activar as contas e definir novas palavras-passe. Não elimine essas colunas nesta fase; primeiro conclua a activação e valide a aplicação.
