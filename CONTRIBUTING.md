# Contribuindo

1. Faça um fork e crie uma branch para sua alteração.
2. Instale as dependências com `npm install`.
3. Mantenha as responsabilidades separadas entre commands, services, stores e embeds.
4. Não inclua tokens, IDs reais de produção, dumps de `data/` ou arquivos `.env`.
5. Rode antes do commit:

```bash
npm run typecheck
```

6. Descreva no pull request o comportamento alterado e como foi testado.

Para novos comandos, defina explicitamente a permissão em `src/services/permissions.ts`. O fallback é Administrador por segurança.
