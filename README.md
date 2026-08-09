# Aurora Codex

Plataforma web de publicação e leitura de histórias seriadas, com construção de universos, personagens e conteúdo multimídia.

## Estado do projeto

O projeto está em fase de MVP estabilizado. A aplicação usa HTML, CSS e JavaScript puros no navegador, Firebase Authentication e Firestore para autenticação e dados, e Cloudinary para imagens e áudio. As regras de segurança estão publicadas, o GitHub Actions valida cada pull request e o GitHub Pages publica a `main`.

Os fluxos existentes estão em [`docs/arquitetura-atual.md`](docs/arquitetura-atual.md), o modelo observado do banco em [`docs/modelo-de-dados.md`](docs/modelo-de-dados.md) e o roteiro de validação em [`docs/checklist-regressao.md`](docs/checklist-regressao.md).

A matriz de permissões, migração de propriedade e procedimento de publicação estão em [`docs/seguranca.md`](docs/seguranca.md).

## Funcionalidades atuais

- Login com uma conta Google e aprovação de novos usuários.
- Perfis `pendente`, `leitor`, `autor` e `admin`.
- Dashboard, biblioteca, busca, filtros e destaques.
- Estante pessoal, favoritos e progresso de leitura.
- Leitura de capítulos com capa, trilha sonora, curtidas e personagens.
- Gestão de livros, capítulos, personagens, universos e galerias.
- Publicações editoriais no Oráculo.
- Administração de usuários e painel de atividade dos leitores.

## Como executar localmente

Como os scripts usam módulos ES, abra o projeto por um servidor HTTP local; abrir os arquivos diretamente com `file://` pode bloquear os imports.

```powershell
python -m http.server 8000
```

Depois acesse `http://localhost:8000`. O domínio local precisa estar autorizado no Firebase Authentication. O navegador também precisa de acesso às CDNs do Firebase, Google Fonts e Cloudinary.

## Validação

```bash
npm ci
npm test
```

O comando valida a sintaxe dos módulos JavaScript e executa os testes das regras do Firestore no emulador. Pull requests e atualizações da `main` executam as mesmas verificações automaticamente pelo GitHub Actions.

## Estrutura

```text
.
├── adm/                    # Telas administrativas
├── autor/                  # Painel de conteúdo do autor
├── css/                    # Estilos globais e por página
├── docs/                   # Arquitetura, dados e validação
├── js/                     # Lógica por página
├── index.html              # Login
├── dashboard.html          # Início do portal
├── biblioteca.html         # Catálogo e filtros
├── estante.html            # Progresso e favoritos
├── ler.html                # Leitor de capítulos
├── universos.html          # Exploração de universos
└── oraculo.html            # Conteúdo editorial
```

A configuração do Firebase e as instâncias compartilhadas de autenticação e Firestore ficam em `js/firebase.js`.

## Dependências externas

- Firebase JavaScript SDK 10.8.0, carregado por CDN.
- Firebase Authentication com provedor Google.
- Cloud Firestore.
- Cloudinary com upload não assinado.
- Google Fonts.

## Estado de produção

As regras do Firestore estão versionadas, cobertas por oito testes no Emulator e publicadas no projeto remoto. O conteúdo rico dos capítulos passa por uma lista permitida de elementos HTML, URLs são validadas e uploads possuem limites no cliente.

A homologação de 8 de agosto de 2026 confirmou login, catálogo, autoria, leitura, universos, Oráculo, estante e administração no GitHub Pages. Testes que alteram perfis, criam ou excluem conteúdo, enviam arquivos ou simulam falha de rede permanecem reservados a um ambiente Firebase de homologação; consulte [`docs/checklist-regressao.md`](docs/checklist-regressao.md).

## Roadmap técnico

1. Criar um projeto Firebase separado para homologação e completar os testes destrutivos.
2. Auditar a migração de `autorId` e `criadoPor` e remover a exceção legada quando seguro.
3. Ampliar testes automatizados dos serviços e fluxos do navegador.
4. Evoluir a experiência de leitores, autores e administradores.
5. Preparar observabilidade, custos, privacidade e escala.
