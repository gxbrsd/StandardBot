# Publicando no GitHub

## 1. Crie o repositório

No GitHub, crie um repositório chamado `StandardBot`.

Se você vai subir esta pasta pronta, não é necessário pedir ao GitHub para criar README, `.gitignore` ou licença, porque esses arquivos já existem no projeto.

## 2. Confira o que será versionado

Na raiz do projeto:

```bash
git init
git status
```

Confirme especialmente que não aparecem:

- `.env`;
- `data/`;
- `node_modules/`;
- imagens pessoais;
- backups de servidor.

## 3. Primeiro commit

```bash
git add .
git commit -m "Initial public release"
git branch -M main
```

## 4. Conecte ao GitHub

Troque `SEU_USUARIO` pelo seu nome de usuário:

```bash
git remote add origin https://github.com/SEU_USUARIO/StandardBot.git
git push -u origin main
```

## 5. Antes de futuros commits

Use:

```bash
git status
git diff --cached
npm run typecheck
```

Nunca use `git add -f .env` ou force a inclusão da pasta `data/`.

## Se um segredo entrar em um commit

Remover o arquivo em um commit posterior não elimina o segredo do histórico. Se um token do Discord tiver sido commitado/pushado:

1. regenere o token imediatamente no Discord Developer Portal;
2. atualize o `.env` local;
3. remova o segredo do histórico antes de considerar o repositório seguro.
