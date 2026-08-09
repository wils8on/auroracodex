# Checklist manual de regressão

Execute antes e depois de mudanças estruturais, preferencialmente em um Firebase de desenvolvimento e com contas separadas por perfil.

## Preparação

- [x] Aplicação servida por HTTP, sem erros críticos no console.
- [ ] Domínio local autorizado no Firebase Authentication.
- [ ] Contas pendente, leitor, autor e admin disponíveis.
- [x] Livro publicado com capítulos, personagem e universo disponível para leitura.
- [ ] Publicação atual e futura no Oráculo.

## Autenticação e perfis

- [ ] Primeiro login cria usuário `pendente`.
- [ ] Pendente é direcionado à tela de espera.
- [ ] Não autenticado não acessa páginas protegidas.
- [ ] Leitor não acessa telas de autor/admin.
- [ ] Autor acessa escritor, mas não administração.
- [x] Admin acessa autor, usuários e leitores.
- [ ] Logout encerra a sessão.

## Portal, biblioteca e leitura

- [x] Dashboard carrega livros e destaque.
- [x] Modal mostra sinopse e capítulos.
- [x] Biblioteca combina filtros de título, gênero e status.
- [x] Capítulo abre pelos IDs da URL.
- [x] Conteúdo e personagens são exibidos; ausência de trilha é informada corretamente.
- [ ] Curtir/descurtir persiste.
- [ ] Leitura cria ou atualiza progresso.
- [ ] Último capítulo marca conclusão.
- [ ] Favorito persiste após recarregar.
- [x] Estante mostra concluídas e favoritas existentes.
- [ ] Continuar lendo abre o último capítulo.

## Universos e Oráculo

- [x] Lista e detalhe de universos carregam.
- [x] Obras vinculadas aparecem no universo correto.
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
- [x] Painel de leitores filtra por e-mail.
- [x] Métricas exibidas correspondem às linhas agregadas apresentadas.

## Segurança — após a Fase 2

- [x] Leitor não altera seu `perfil` (teste automatizado de regras).
- [x] Leitor não grava conteúdo editorial (teste automatizado de regras).
- [x] Autor não altera obra de outro autor (teste automatizado de regras).
- [x] Autor não concede perfis (teste automatizado de regras).
- [x] Usuário não acessa progresso alheio (teste automatizado de regras).
- [ ] HTML malicioso não executa scripts.
- [ ] URLs inseguras são rejeitadas.
- [ ] Upload rejeita formatos e tamanhos proibidos.

## Homologação de produção — 8 de agosto de 2026

Versão final validada no GitHub Pages: `7d9fb4a`. Conta usada: `wilsononole@gmail.com`, perfil `admin`.

- Login e sessão publicados funcionaram no navegador externo.
- Dashboard e biblioteca exibiram as seis obras existentes.
- O painel `Suas Obras` exibiu as seis obras, com busca, contagem e paginação coerentes.
- A correção do estado vazio foi retestada: aviso oculto quando existem resultados e console limpo.
- O universo `NEXUM` exibiu quatro obras vinculadas.
- O Oráculo carregou a publicação vigente sem erros.
- A estante exibiu dois favoritos e uma obra concluída.
- O capítulo 1 de `Laços Invisíveis` abriu pelos IDs, exibiu conteúdo e personagem e respondeu aos controles de leitura.
- Administração exibiu sete perfis, incluindo a conta proprietária como `Admin`; o painel de leitores mostrou 1 leitor único, 2 favoritos e 1 conclusão.
- A suíte local validou 19 módulos JavaScript e 8/8 cenários das regras do Firestore.

Os itens ainda desmarcados exigem contas separadas por papel, alteração de dados, upload real ou simulação de falha. Devem ser executados em um projeto Firebase de homologação para não modificar conteúdo e usuários de produção.
