# Segurança e autorização

## Estado

As regras estão versionadas em `firestore.rules`, associadas por `firebase.json` e publicadas no projeto `aurora-codex`. Em 8 de agosto de 2026, a suíte `tests/firestore.rules.test.mjs` foi executada no Firestore Emulator 1.19.8: 8 testes passaram e nenhum falhou. A publicação em produção foi confirmada no console do Firebase e os principais fluxos foram retestados no GitHub Pages.

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

O painel de autor foi acessado pela conta legada e as seis obras ficaram disponíveis em `Suas Obras`, acionando a migração dos documentos sem `autorId`. Antes de remover a exceção temporária baseada em e-mail, faça uma auditoria direta dos campos `autorId` e `criadoPor` no Firestore.

## Conteúdo e arquivos

- Capítulos usam uma lista permitida de elementos HTML na gravação e leitura.
- Texto do Oráculo e personagens é escapado antes de entrar em templates críticos.
- URLs de leitura aceitam apenas HTTP e HTTPS.
- Imagens têm limite de 10 MB e áudio de 50 MB no cliente.

Validação no cliente melhora a experiência, mas limites equivalentes devem ser configurados no preset do Cloudinary. O preset não assinado continua sendo uma superfície externa ao Firestore.

## Rotina para próximas alterações

1. Executar `npm ci` e repetir `npm test` antes de cada mudança nas regras.
2. Fazer backup do banco de produção.
3. Publicar somente as regras: `firebase deploy --only firestore:rules`.
4. Confirmar a versão ativa no console do Firebase.
5. Executar a checklist de regressão e segurança em homologação e repetir os fluxos críticos em produção.
