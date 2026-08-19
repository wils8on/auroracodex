# Modelo de dados observado

Este documento foi derivado das leituras e gravações presentes no JavaScript. O Firestore não impõe esquema; registros antigos podem não conter todos os campos.

## Estrutura

```text
usuarios/{uid}
livros/{livroId}
  ├── capitulos/{capituloId}
  ├── personagens/{personagemId}
  └── galeria/{itemId}
universos/{universoId}
oraculo/{postId}
progresso_leitura/{uid}_{livroId}
configuracoes/catalogo
```

## Coleções e campos

### `usuarios/{uid}`

- `nome`, `email`, `foto_perfil`
- `perfil`: `pendente`, `leitor`, `autor` ou `admin`
- `data_cadastro`: data `YYYY-MM-DD`

O próprio usuário cria o documento inicial. Apenas administradores deveriam poder alterar `perfil` depois da criação.

### `livros/{livroId}`

- `titulo`, `genero`, `status`, `sinopse`
- `subgeneros`: array de strings
- `capa`, `corTema`, `destacar`
- `data_criacao`: string ISO
- `universoId`, `universoNome`, `universo`

`autorId` contém o UID do proprietário. Obras legadas recebem o UID de `wilsononole@gmail.com` no primeiro acesso ao painel. `criadoPor` e `atualizadoEm` apoiam auditoria e migração.

### `livros/{livroId}/capitulos/{capituloId}`

- `numero`, `titulo`, `status`, `conteudo`
- `trilhaSonora`, `capa`, `corCena`
- `data_publicacao`, `data_agendamento`
- `curtidasUids`: array de UIDs

`status` aceita `rascunho`, `agendado` e `publicado`. Um capítulo agendado só é exibido ao leitor quando `data_agendamento` for atingida.

`conteudo` é HTML e precisa ser sanitizado. Curtidas em um array dentro do capítulo podem atingir limites de tamanho em escala.

### `livros/{livroId}/personagens/{personagemId}`

- `nome`, `papel`, `primeiraAparicao`, `capitulosAparicao`, `foto`, `descricao`

`capitulosAparicao` contém os IDs de todos os capítulos em que o personagem aparece. O Códice do leitor usa essa lista para revelar apenas personagens presentes no capítulo atual.

A ficha completa do personagem é aberta a partir do Códice durante a leitura. Personagens legados sem `capitulosAparicao` permanecem ocultos até que o autor associe seus capítulos no painel.

### `livros/{livroId}/galeria/{itemId}`

- `titulo`, `tipo`, `categoria`, `url`, `descricao`, `ordem`, `data_criacao`

### `universos/{universoId}`

- `nome`, `descricao`, `corTema`, `capa`, `data_criacao`

O vínculo é armazenado nos livros e o nome do universo é duplicado para exibição. `criadoPor` identifica o autor responsável; universos legados são atribuídos à conta proprietária das obras existentes.

### `oraculo/{postId}`

- `titulo`, `tipo`, `conteudo`
- `livrosRelacionados`: array de IDs
- `imagem`, `dataPublicacao`, `data_criacao`

### `progresso_leitura/{uid}_{livroId}`

- `uid`, `emailUsuario`, `nomeUsuario`
- `livroId`, `livroTitulo`, `livroCapa`
- `ultimoCapituloNumero`, `ultimoCapituloTitulo`, `ultimoCapituloId`
- `status`: `ativa` ou `concluida`
- `dataUltimaLeitura`, `dataInicio`, `favorito`

O usuário deve acessar apenas registros cujo `uid` seja o seu. Administradores precisam de leitura global para métricas.

### `configuracoes/catalogo`

- `generos`: array de strings
- `subgeneros`: array de strings

Atualmente o painel de autor altera esse catálogo global. É preciso decidir se isso continuará permitido a autores.

## Decisões de autorização aprovadas

1. Obras legadas pertencem à conta `wilsononole@gmail.com`.
2. Apenas administradores alteram o catálogo global.
3. Autores gerem seus universos; apenas administradores gerem o Oráculo.
4. Obras ficam visíveis somente a usuários aprovados nesta etapa.
5. Administradores acessam os dados de progresso necessários às métricas.
