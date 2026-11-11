# NEUROJUS — Auditoria técnica inicial

**Branch:** `fix/neurojus-vercel-supabase`  
**Base:** `main`  
**Estado:** correcções iniciais aplicadas; auditoria e validação de produção ainda não concluídas.

## Decisões respeitadas

- Não criar um projecto novo.
- Manter React + TypeScript + Vite.
- Manter o mecanismo de login e as contas existentes; não migrar para Supabase Auth.
- Não executar alterações na base de dados Supabase.
- Não eliminar tabelas, registos, dados locais ou funcionalidades.
- Não alterar a branch `main`.

## Alterações já aplicadas

1. **Configuração Supabase no frontend:** removidos URL e chave pública embutidos como fallback. O frontend lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; o teste de conectividade informa quando faltam variáveis. Foi corrigida a normalização da URL.
2. **Configuração Supabase nas Vercel Functions:** removidos fallbacks embutidos. As rotas usam a chave pública anon/publishable, nunca `service_role`, porque ainda não existe validação uniforme de sessão nas rotas. A constante `SUPABASE_KEY` usada pelo endpoint de estado foi preservada.
3. **Login:** removidas senhas universais alternativas (`admin`, `123`, `123456`, etc.) da validação normal, removidas dicas que revelavam senhas e os campos deixaram de vir pré-preenchidos. Acesso rápido de demonstração disponível apenas em desenvolvimento.
4. **Ambiente:** `.env.example` actualizado com placeholders seguros e os nomes das variáveis encontrados no código.

## Problemas críticos ainda por resolver

### 1. Autenticação apenas no navegador
O login actual compara as senhas com dados já carregados no frontend e chama `onLoginSuccess`. Não existe sessão de servidor que proteja todas as operações. As alterações reduzem bypasses óbvios, mas **não tornam o mecanismo actual seguro para produção**. Como foi decidido não usar Supabase Auth, a solução terá de ser autenticação própria no servidor, compatível com as contas actuais, com sessão assinada, expiração e autorização por função.

### 2. Senhas devolvidas pelas rotas de dados
`api/data/index.ts` e `api/supabase/pull.ts` incluem actualmente campos de senha de vendedores e da empresa nas respostas. Isto expõe credenciais a qualquer cliente que consiga chamar as rotas. Remover estes campos sem adaptar primeiro o login quebraria o acesso actual; é necessário criar validação de credenciais no servidor e só depois retirar as senhas das respostas.

### 3. Rotas sem autorização uniforme
As rotas de leitura e sincronização não apresentam verificação consistente de identidade/permissões. Por isso, o backend foi configurado para usar apenas a chave pública e depender de RLS, em vez de elevar privilégios com `service_role`. As políticas RLS efectivamente instaladas no projecto Supabase ainda precisam de ser inventariadas e validadas.

### 4. Sessões SMS em memória
`api/sms/_session.ts` mantém sessões e transacções em `Map`. Vercel Functions podem executar em instâncias diferentes ou reiniciar; a sessão criada numa invocação pode não existir na seguinte. A confirmação não é fiável em produção até existir persistência partilhada e operações atómicas.

### 5. Código de confirmação exposto
As rotas SMS devolvem o código de confirmação em respostas de API; a rota de recibo também pode devolver o código guardado na dívida. É necessário remover essa exposição, guardar apenas hashes e separar o modo de teste do envio real.

### 6. Sincronização pode comunicar sucesso parcial
`api/supabase/sync.ts` e o fluxo do frontend não verificam consistentemente todos os erros devolvidos por cada operação Supabase. Há blocos que capturam erros e continuam, podendo indicar sucesso mesmo quando parte dos dados não foi gravada. A sincronização precisa de verificação por tabela, idempotência e relatório de falhas.

### 7. Persistência local e cloud duplicada
`server.ts` conserva uma implementação Express e armazenamento JSON local, enquanto a Vercel usa funções em `api/`. O armazenamento local não é persistência partilhada entre instâncias Vercel e não deve ser tratado como cópia de segurança cloud.

### 8. RLS e esquema remoto não confirmados
`supabase-schema.sql` é apenas um ficheiro do repositório; não prova que as tabelas, constraints, triggers e políticas actualmente aplicadas no projecto Supabase sejam iguais. Não foi executado SQL nem alterada a base de dados.

## Variáveis de ambiente

Consultar `.env.example`. A chave pública pode estar no frontend; nunca colocar `service_role`, tokens SMS ou segredos de sessão em variáveis `VITE_*`.

## Validação e limites desta execução

- As alterações foram gravadas na branch de correcção; `main` permanece intacta.
- Não foi possível executar `npm install`, `npm run build` ou `npm run lint`: o ambiente de execução não conseguiu aceder à rede para obter o repositório/dependências.
- Não foram executados testes contra o Supabase.
- Não foram feitas migrações SQL nem alterações na base de dados.
- Não se afirma que o projecto esteja pronto para produção.

## Próximas etapas

1. Inventariar o esquema e as políticas RLS realmente instaladas, sem modificar dados.
2. Implementar autenticação própria no servidor, sem Supabase Auth, compatível com os utilizadores actuais.
3. Remover senhas de todas as respostas de leitura e adaptar o login ao endpoint de validação.
4. Proteger todas as rotas com sessão e permissões.
5. Persistir sessões SMS numa tabela nova, por migração incremental aprovada antes da execução.
6. Corrigir a sincronização para falhar claramente quando qualquer tabela obrigatória não for gravada.
7. Executar build, lint e testes funcionais antes de propor merge.

**Aviso:** esta branch contém melhorias iniciais, mas não deve ser publicada como versão de produção até os pontos críticos serem resolvidos e testados.

## Revisão da interface — 11 de Novembro de 2026

Na revisão posterior foram aplicadas, nesta mesma branch, as seguintes correcções:

1. Uniformizada a marca visível para **NEUROJUS** no login, navegação lateral, cabeçalho, dashboard, metadados do navegador e identificação PWA. Os identificadores antigos de login e os nomes internos de compatibilidade foram mantidos para não bloquear contas existentes.
2. Corrigida a distinção visual dos gráficos de recuperação: montante recuperado em verde e saldo pendente em cinzento, incluindo as respectivas legendas.
3. Associados os rótulos dos campos de utilizador e senha aos respectivos inputs através de `htmlFor` e `id`; adicionados nomes acessíveis aos controlos de mostrar/ocultar senha, abrir/fechar menu, instalar a aplicação e terminar sessão.
4. Acrescentado `type="button"` aos controlos de navegação e acção que não devem submeter formulários.
5. Mantida a identidade cromática verde e branca e a estrutura React + TypeScript + Vite.

### Limites que permanecem

- **Autenticação própria no servidor ainda não implementada.** O login continua a comparar senhas no cliente; a sessão continua no `localStorage`. As APIs de leitura ainda precisam de deixar de devolver campos de senha. Não declarar esta versão segura para produção.
- A implementação completa da autenticação deve ser feita de forma coordenada: endpoint de login, sessão assinada em cookie HttpOnly/Secure/SameSite, validação em todas as rotas privadas, autorização por função, protecção contra tentativas repetidas e remoção dos campos de senha das respostas. Antes disso, é necessário confirmar o formato real das credenciais existentes e as políticas RLS actualmente aplicadas. Não se deve introduzir uma migração ou alterar credenciais sem aprovação.
- Não foram executados `npm run build`, `npm run lint`, testes visuais em navegador ou testes reais com Supabase nesta revisão.
- Nenhum dado/tabela Supabase foi alterado; nenhum SQL foi executado; `main` não foi modificada e não foi publicado deploy.
