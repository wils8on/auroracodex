# Checklist manual de regressão

Execute antes e depois de mudanças estruturais, preferencialmente em um Firebase de desenvolvimento e com contas separadas por perfil.

## Preparação

- [ ] Aplicação servida por HTTP, sem erros críticos no console.
- [ ] Domínio local autorizado no Firebase Authentication.
- [ ] Contas pendente, leitor, autor e admin disponíveis.
- [ ] Livro de teste com dois capítulos, personagem, galeria e universo.
- [ ] Publicação atual e futura no Oráculo.

## Autenticação e perfis

- [ ] Primeiro login cria usuário `pendente`.
- [ ] Pendente é direcionado à tela de espera.
- [ ] Não autenticado não acessa páginas protegidas.
- [ ] Leitor não acessa telas de autor/admin.
- [ ] Autor acessa escritor, mas não administração.
- [ ] Admin acessa autor, usuários e leitores.
- [ ] Logout encerra a sessão.

## Portal, biblioteca e leitura

- [ ] Dashboard carrega livros e destaque.
- [ ] Modal mostra sinopse, capítulos e galeria.
- [ ] Biblioteca combina filtros de título, gênero, status e tags.
- [ ] Capítulo abre pelos IDs da URL.
- [ ] Conteúdo, capa, cor, personagens e trilha são exibidos.
- [ ] Curtir/descurtir persiste.
- [ ] Leitura cria ou atualiza progresso.
- [ ] Último capítulo marca conclusão.
- [ ] Favorito persiste após recarregar.
- [ ] Estante mostra ativas, concluídas e favoritas.
- [ ] Continuar lendo abre o último capítulo.

## Universos e Oráculo

- [ ] Lista e detalhe de universos carregam.
- [ ] Obras vinculadas aparecem no universo correto.
- [ ] Oráculo não exibe publicação futura.
- [ ] Filtros e livros relacionados funcionam.

## Autor

- [ ] Criar, editar e excluir livro.
- [ ] Upload e pré-visualização de capa.
- [ ] Criar e editar capítulo publicado ou rascunho.
- [ ] Preservar capa e trilha ao editar capítulo.
- [ ] Upload de áudio conclui e libera o formulário.
- [ ] Criar, editar e excluir personagem.
- [ ] Gerir universo e sincronizar vínculos.
- [ ] Gerir imagem e vídeo da galeria.
- [ ] Publicar e agendar conteúdo no Oráculo.
- [ ] Erro de rede libera novamente os botões.

## Administração

- [ ] Lista de usuários atualiza em tempo real.
- [ ] Mudança de perfil vale no próximo acesso.
- [ ] Painel de leitores filtra por e-mail.
- [ ] Métricas correspondem aos registros.

## Segurança — após a Fase 2

- [ ] Leitor não altera seu `perfil`.
- [ ] Leitor não grava conteúdo editorial.
- [ ] Autor não altera obra de outro autor.
- [ ] Autor não concede perfis.
- [ ] Usuário não acessa progresso alheio.
- [ ] HTML malicioso não executa scripts.
- [ ] URLs inseguras são rejeitadas.
- [ ] Upload rejeita formatos e tamanhos proibidos.
