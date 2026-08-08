# Segurança e autorização

## Estado

As regras locais estão em `firestore.rules` e a associação em `firebase.json`. Em 8 de agosto de 2026, a suíte `tests/firestore.rules.test.mjs` foi executada no Firestore Emulator 1.19.8: 6 testes passaram e nenhum falhou. As regras ainda não foram publicadas no projeto remoto; manter o arquivo no repositório não altera as regras ativas no console.

## Matriz implementada

| Recurso | Leitor | Autor | Admin |
|---|---|---|---|
| Obras publicadas e conteúdo | leitura | leitura | leitura |
| Livro e subcoleções | — | somente próprios | todos |
| Curtida de capítulo | altera apenas `curtidasUids` | igual | igual |
| Progresso | somente próprio | somente próprio | leitura global |
| Perfil de usuário | próprio, sem mudar papel | próprio, sem mudar papel | todos e papéis |
| Catálogo | leitura | leitura | escrita |
| Universo | leitura | somente próprios | todos |
| Oráculo | leitura | leitura | escrita |

## Migração legada

Ao entrar no painel de autor com `wilsononole@gmail.com`, livros sem `autorId` recebem o UID autenticado e universos sem `criadoPor` recebem o mesmo UID. As regras permitem essa atribuição somente para esse e-mail e somente quando o campo ainda não existe.

Antes de publicar as regras, faça backup do Firestore e execute a checklist de segurança. Após confirmar a migração, uma etapa posterior pode remover a exceção temporária baseada em e-mail.

## Conteúdo e arquivos

- Capítulos usam uma lista permitida de elementos HTML na gravação e leitura.
- Texto do Oráculo e personagens é escapado antes de entrar em templates críticos.
- URLs de leitura aceitam apenas HTTP e HTTPS.
- Imagens têm limite de 10 MB e áudio de 50 MB no cliente.

Validação no cliente melhora a experiência, mas limites equivalentes devem ser configurados no preset do Cloudinary. O preset não assinado continua sendo uma superfície externa ao Firestore.

## Publicação planejada

1. Instalar Node.js, Java e as dependências de desenvolvimento com `npm install`.
2. Repetir os testes no Emulator com `npm run test:rules` antes de cada mudança nas regras.
3. Fazer backup do banco de produção.
4. Publicar somente as regras: `firebase deploy --only firestore:rules`.
5. Entrar como proprietário legado e confirmar `autorId`/`criadoPor`.
6. Executar a checklist completa de regressão e segurança.
