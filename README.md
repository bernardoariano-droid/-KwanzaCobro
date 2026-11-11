# KwanzaCobro · Gestão e Controlo de Dívidas Empresariais 🇦🇴

Sistema corporativo moderno, intuitivo e totalmente responsivo (otimizado para dispositivos Android, tablets e computadores) para controlo de compras a crédito, plafonds, prazos de vencimento, cobranças e amortizações em Kwanzas (**Kz / AOA**) com integração direta ao banco de dados **Supabase**.

---

## 🚀 Guia Rápido de Deploy

### 1. Como Subir o Projeto para o GitHub

Se ainda não inicializou o repositório Git local, abra o terminal na pasta do projeto e execute:

```bash
# 1. Inicializar o repositório git
git init

# 2. Adicionar todos os ficheiros (o .gitignore já protege chaves e ficheiros temporários)
git add .

# 3. Criar o primeiro commit
git commit -m "feat: KwanzaCobro v1.0 - Sistema de Gestão de Dívidas Empresariais"

# 4. Definir o ramo principal como 'main'
git branch -M main

# 5. Associar ao seu repositório no GitHub (substitua pelo link do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# 6. Enviar para o GitHub
git push -u origin main
```

---

### 2. Como Fazer o Deploy na Vercel (Passo a Passo)

O projeto está 100% pré-configurado com `vercel.json` para o framework **Vite (React Single Page Application)**.

1. Aceda a [https://vercel.com](https://vercel.com) e inicie sessão com a sua conta GitHub.
2. Clique no botão **"Add New..."** > **"Project"**.
3. Na lista de repositórios do GitHub, selecione o repositório do **KwanzaCobro** e clique em **"Import"**.
4. A Vercel detectará as configurações automaticamente:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Abra o separador **Environment Variables** (Variáveis de Ambiente) e adicione as seguintes variáveis:

| Nome da Variável | Valor |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://ckcwpcnsfennfjmjwoqp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_U4Rgccyd4DrhKeI7AuVyCQ_tYnwa-6p` |

*(Opcional: se desejar testar com backend Node.js dedicado, adicione também `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os mesmos valores).*

6. Clique no botão azul **"Deploy"**.
7. Em cerca de 1 minuto, a aplicação estará no ar com certificado SSL/HTTPS gratuito e domínio próprio (`https://seu-projeto.vercel.app`).

---

### 3. Configuração do Banco de Dados no Supabase

O projeto inclui o ficheiro completo com a estrutura SQL pronta na raiz: **`supabase-schema.sql`**.

Caso precise de criar ou atualizar as tabelas no Supabase:
1. Aceda ao painel do seu projeto no Supabase: [https://supabase.com/dashboard/project/ckcwpcnsfennfjmjwoqp](https://supabase.com/dashboard/project/ckcwpcnsfennfjmjwoqp).
2. No menu lateral esquerdo, clique em **SQL Editor** > **New Query**.
3. Abra o ficheiro `supabase-schema.sql` deste projeto, copie todo o conteúdo, cole no SQL Editor do Supabase e clique em **Run**.
4. As tabelas relacionais com chaves estrangeiras e integridade referencial serão criadas:
   - `company_settings` (Dados da empresa, IBAN, MCX e senha)
   - `sellers` (Funcionários comerciais e administradores com senhas)
   - `clients` (Clientes B2B e particulares com plafonds)
   - `debts` (Faturas e compras a crédito)
   - `debt_items` (Itens discriminados de cada compra)
   - `payments` (Amortizações e comprovativos)
   - `audit_trail` (Histórico de auditoria)
   - `kwanzacobro_sync` (Snapshot de sincronização rápida)

---

### 4. Como Executar Localmente na sua Máquina

```bash
# 1. Instalar dependências
npm install

# 2. Configurar o ficheiro de ambiente
cp .env.example .env

# 3. Iniciar o servidor de desenvolvimento
npm run dev

# 4. Compilar para produção
npm run build

# 5. Testar a versão de produção localmente
npm run preview
```

---

### 5. Estrutura do Projeto

```text
├── api/                    # (Opcional) Funções serverless
├── data/                   # Armazenamento e persistência local
├── dist/                   # Ficheiros otimizados gerados pelo build
├── public/                 # Ícones, manifest PWA e fotos estáticas
├── src/
│   ├── components/         # Módulos da UI (Dashboard, Dívidas, Clientes, etc.)
│   ├── data/               # Modelos e sementes iniciais
│   ├── i18n/               # Internacionalização (PT, EN, FR, AR, ES)
│   ├── lib/                # Cliente Supabase e sincronização
│   ├── types/              # Tipagem TypeScript
│   └── utils/              # Formatadores monetários Kwanza e geradores PDF
├── .env.example            # Exemplo documentado de variáveis
├── .gitignore              # Proteção contra envio de segredos para o Git
├── index.html              # Ponto de entrada HTML com SEO e PWA
├── package.json            # Scripts de build e dependências
├── supabase-schema.sql     # Script SQL relacional com triggers para o Supabase
├── vercel.json             # Configuração para deploy direto na Vercel
└── vite.config.ts          # Configuração do Vite e Tailwind CSS
```

---

### 🛡️ Credenciais Padrão de Acesso Inicial

- **Administrador Geral**:
  - Utilizador: `admin@kwanzacobro.ao` ou `923 884 100`
  - Senha: `admin`
- **Vendedor Comercial**:
  - Utilizador: `joao.silva@kwanzacobro.ao` ou `923 111 222`
  - Senha: `123`
