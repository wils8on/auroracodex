# Arquitetura atual

Referência da Fase 1, baseada no código em 8 de agosto de 2026. Ela descreve o comportamento encontrado, sem afirmar que as permissões do backend já estejam protegidas.

## Visão geral

O Aurora Codex é uma aplicação multipágina executada integralmente no navegador. Cada página carrega seu módulo JavaScript e acessa o Firestore diretamente. A configuração e as instâncias compartilhadas do Firebase ficam centralizadas em `js/firebase.js`. Não existe backend próprio neste repositório.

A leitura de perfis e as verificações reutilizáveis de papel ficam em `js/user-service.js`. Todas as páginas protegidas, inclusive o leitor de capítulos, consultam esse serviço antes de iniciar seus dados.

As assinaturas e consultas reutilizáveis do catálogo ficam em `js/catalog-service.js`. Estante, Universos e Oráculo já consomem esse serviço; Dashboard e Biblioteca serão migrados em conjunto com o modal compartilhado de obras.

Favoritos e leitura do progresso individual ficam em `js/progress-service.js`. Dashboard, Biblioteca, Estante, Universos e Oráculo usam a mesma persistência e revertem a atualização otimista do botão quando a gravação falha.

O visualizador de imagens e vídeos das galerias fica em `js/media-viewer.js`. O componente é compartilhado por Dashboard, Biblioteca, Universos e Oráculo, valida URLs e oferece fechamento por teclado.

A apresentação da lista de capítulos fica em `js/chapter-list.js`. Estante, Universos e Oráculo já usam o componente, que evita interpolação de conteúdo persistido e permite abrir capítulos por teclado.

```text
Navegador
  ├── HTML e CSS estáticos
  ├── JavaScript por página
  ├── Firebase Authentication (Google)
  ├── Cloud Firestore (dados em tempo real)
  └── Cloudinary (imagens e áudio)
```

## Perfis e fluxo de acesso

| Perfil | Comportamento atual da interface |
|---|---|
| Não autenticado | Redirecionado para `index.html` nas páginas protegidas |
| `pendente` | Direcionado para `aguardando.html` em login e páginas do portal |
| `leitor` | Acessa portal, biblioteca, universos, estante, Oráculo e leitor |
| `autor` | Recebe também acesso a `autor/gerenciar-livros.html` |
| `admin` | Acessa painel do autor e telas administrativas |

As telas de autor e administração consultam `usuarios/{uid}.perfil`. Isso é uma proteção de interface; a autorização efetiva precisa existir nas regras do Firestore.

## Fluxos funcionais

### Entrada e aprovação

1. O usuário entra com Google em `index.html`.
2. No primeiro acesso, é criado `usuarios/{uid}` com perfil `pendente`.
3. O usuário vê `aguardando.html`.
4. Um administrador altera seu perfil no painel de usuários.
5. No acesso seguinte, o usuário é direcionado ao portal.

### Leitor

1. Explora destaques ou consulta a biblioteca.
2. Filtra obras por título, gênero, status e tags.
3. Abre detalhes, capítulos e galeria de uma obra.
4. Favorita uma obra ou inicia um capítulo.
5. A leitura atualiza `progresso_leitura/{uid}_{livroId}`.
6. A estante reúne leituras ativas, concluídas e favoritas.
7. Curtidas ficam registradas no documento do capítulo.

### Autor

O painel permite gerir livros, capítulos, personagens, catálogo, universos, galerias e publicações do Oráculo, além de enviar imagens e áudio ao Cloudinary.

Limitação estrutural: documentos de `livros` não registram `autorId`. Portanto, o sistema ainda não consegue garantir que cada autor edite somente suas obras. A Fase 2 deverá adicionar esse campo e tratar os registros existentes.

### Administração

- Lista usuários em tempo real.
- Altera perfis entre `pendente`, `leitor`, `autor` e `admin`.
- Consulta progresso por leitor e desempenho agregado por livro.

## Páginas e módulos

| Página | Módulo | Responsabilidade |
|---|---|---|
| `index.html` | `js/auth.js` | Login e criação do perfil pendente |
| `dashboard.html` | `js/app.js` | Destaques, catálogo resumido e detalhes |
| `biblioteca.html` | `js/biblioteca.js` | Catálogo, filtros e detalhes |
| `estante.html` | `js/estante.js` | Progresso e favoritos |
| `ler.html` | `js/ler.js` | Leitura, multimídia, curtidas e progresso |
| `universos.html` | `js/universos.js` | Universos e livros vinculados |
| `oraculo.html` | `js/oraculo.js` | Feed editorial |
| `autor/gerenciar-livros.html` | `js/autor.js` | Operações editoriais |
| `adm/painel-usuarios.html` | `js/adm.js` | Perfis de usuários |
| `adm/leitores.html` | `js/adm-leitores.js` | Métricas de leitura |

## Dívida técnica observada

- Acesso ao Firestore ainda ocorre diretamente nos módulos de página; a inicialização já foi centralizada em `js/firebase.js`.
- Renderização e lógica de livros duplicadas em várias páginas.
- `js/autor.js` concentra responsabilidades distintas.
- Ausência de testes, lint, build e ambientes separados.
- Ausência de regras e índices do Firebase no repositório.
- Uso frequente de `innerHTML` com dados persistidos.
- Ausência de propriedade de autor nos livros.
- Exclusão de livro não elimina automaticamente subcoleções nem mídia externa.
- Listeners em tempo real são usados em consultas amplas.

## Fronteira da Fase 1

Esta fase documenta o sistema e cria uma referência de regressão. Ela não altera dados, permissões, interface ou comportamento. A próxima fase transformará a matriz de acesso desejada em regras testáveis e tratará os pontos de injeção de conteúdo.
