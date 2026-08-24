# Carcará · Sistema de Missões — Guia de publicação

Este projeto é um site React (Vite) + Netlify Functions + Netlify Blobs —
mesma stack leve do "App de Solicitação de Pedidos" que fizemos antes.
**Não precisa de nenhum banco de dados externo**: tudo (cadastros, missões,
financeiro e os arquivos anexados) fica guardado no Netlify Blobs, dentro do
próprio site.

Siga os passos na ordem. No fim você vai ter o link do sistema publicado e o
primeiro administrador cadastrado.

## O que você vai precisar

- Uma conta no [Netlify](https://netlify.com) (grátis).
- Uma conta no [Google Cloud Console](https://console.cloud.google.com) (grátis) — para o login com Google.
- Uma conta no GitHub (ou GitLab/Bitbucket) para hospedar o código.

---

## Passo 1 — Criar as credenciais do login com Google

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto novo (ex: "Carcará Missões").
2. No menu, vá em **APIs e Serviços → Tela de consentimento OAuth**.
   - Tipo de usuário: **Externo**.
   - Preencha nome do app ("Carcará · Sistema de Missões"), e-mail de suporte e e-mail do desenvolvedor.
   - Em "Público-alvo"/"Test users", adicione os e-mails do time enquanto o app estiver em modo de teste (ou publique o app depois, se quiser liberar geral).
3. Vá em **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione:
     - `http://localhost:5173` (para testar no seu computador)
     - `https://SEU-SITE.netlify.app` (o domínio que o Netlify vai te dar no Passo 3 — pode voltar aqui depois para adicionar)
   - Não precisa preencher "URIs de redirecionamento" (o login usa o fluxo de token do Google Identity Services, sem redirecionamento).
4. Copie o **Client ID** gerado — você vai usar duas vezes no Passo 4 (`VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_ID`).

## Passo 2 — Subir o código para o GitHub

Dentro da pasta do projeto (a mesma pasta deste arquivo):

```bash
git init
git add .
git commit -m "Sistema de Missões Carcará - versão inicial"
```

Crie um repositório vazio no GitHub (ex: `carcara-missoes`) e depois:

```bash
git remote add origin https://github.com/SEU-USUARIO/carcara-missoes.git
git branch -M main
git push -u origin main
```

## Passo 3 — Conectar ao Netlify

1. No painel do Netlify, clique em **Add new site → Import an existing project**.
2. Escolha o repositório `carcara-missoes` que você acabou de criar.
3. O Netlify já detecta as configurações do arquivo `netlify.toml` deste projeto (build `npm run build`, pasta publicada `dist`, funções em `netlify/functions`). Não precisa mudar nada — só clicar em **Deploy**.
4. O primeiro deploy provavelmente vai falhar (ou o login não vai funcionar ainda) porque faltam as variáveis de ambiente — é normal, siga para o próximo passo.
5. Depois do primeiro deploy, copie a URL do site (ex: `https://carcara-missoes.netlify.app`) e volte no Google Cloud Console (Passo 1.3) para adicioná-la nas Origens JavaScript autorizadas.

## Passo 4 — Configurar as variáveis de ambiente

No Netlify: **Site settings → Environment variables → Add a variable**. Adicione (use o arquivo `.env.example` deste projeto como referência):

| Variável | Valor |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID do Passo 1 |
| `GOOGLE_CLIENT_ID` | O mesmo Client ID do Passo 1 |
| `JWT_SECRET` | Uma string aleatória longa (gere com `openssl rand -hex 32` ou qualquer gerador de senha) |
| `ADMIN_BOOTSTRAP_EMAILS` | Seu e-mail do Google (o que vai virar o 1º administrador) |

Depois de salvar, vá em **Deploys → Trigger deploy → Deploy site** para publicar de novo já com as variáveis.

## Passo 5 — Primeiro acesso

1. Abra a URL do site publicado.
2. Clique em **Entrar com Google** e use o e-mail que você colocou em `ADMIN_BOOTSTRAP_EMAILS`.
3. Esse e-mail vira automaticamente **Administrador / Ativo** no primeiro login (só funciona enquanto não houver nenhum colaborador cadastrado — depois disso, todo cadastro novo é manual, pelo próprio sistema).
4. Vá em **Cadastros → Colaboradores** e cadastre o resto do time (nome, sobrenome, e-mail do Google de cada um, perfil e status). Só quem estiver cadastrado e "Ativo" consegue entrar.
5. Vá em **Cadastros → Campos** para cadastrar os campos de jogo.

Pronto — o sistema está no ar.

---

## Notas técnicas

- **Sem banco externo:** todos os dados ficam no Netlify Blobs, dentro do
  próprio site. Não precisa configurar nada além das variáveis de ambiente.
- **Sem envio de e-mail:** o sistema não manda nenhuma notificação por
  e-mail, SMS ou WhatsApp — todo o acompanhamento (novas missões, mudanças
  de status, aprovações) é feito dentro do próprio sistema, nas telas de
  Consulta de Missões, Análise e Financeiro.
- **Anexos:** cartas da missão, imagens e mapas dos campos, até 8MB por
  arquivo (dá pra aumentar depois se precisar, mas arquivos muito grandes
  deixam o upload mais lento).
- **Numeração da missão** (`001-2026`): gerada só quando clica em "Enviar
  para Análise", sequencial por ano. A implementação é "melhor esforço" —
  ótima para o uso normal de um time, mas não é um contador 100% à prova de
  duas pessoas clicando enviar no exato mesmo milissegundo (cenário
  extremamente improvável aqui).
- **Login restrito:** só entra quem já está cadastrado como colaborador
  Ativo — cadastrar é sempre feito por um Administrador dentro do sistema
  (Cadastros → Colaboradores), exceto o primeiro admin (`ADMIN_BOOTSTRAP_EMAILS`).

## Rodando localmente (opcional)

```bash
npm install
cd netlify/functions && npm install && cd ../..
npm install -g netlify-cli   # se ainda não tiver
cp .env.example .env         # preencha com suas credenciais
netlify dev
```

Isso sobe o site e as funções juntos em `http://localhost:8888`.

## Estrutura do projeto

```
src/                     front-end (React + Vite)
  pages/cadastros/        Colaboradores, Campos
  pages/missoes/           Nova Missão, Consulta, Campos disponíveis
  pages/analise/            Análise de Missões, Avaliação de Missões
  pages/financeiro/          Lançamento Financeiro, Caixa Geral
  pages/aprovacao/            Aprovação Financeira
netlify/functions/       back-end (API + regras de acesso por perfil)
  _lib/                    sessão, Blobs, http helpers
shared/                  tipos e cálculos usados pelos dois lados
public/                  logo, favicon, badge de status (emblema recolorível)
```
