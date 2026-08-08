# Aurora Codex

Plataforma web de publicação e leitura de histórias seriadas, com construção de universos, personagens e conteúdo multimídia.

## Estado do projeto

O projeto está em fase de MVP funcional. A aplicação usa HTML, CSS e JavaScript puros no navegador, Firebase Authentication e Firestore para autenticação e dados, e Cloudinary para imagens e áudio.

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

## Atenção antes de produção

Este repositório ainda não contém regras versionadas do Firestore, testes automatizados ou uma configuração formal de implantação. As verificações de perfil feitas no navegador melhoram a navegação, mas não substituem regras de segurança no banco.

O conteúdo rico dos capítulos passa por uma lista permitida de elementos HTML. As regras do Firestore estão versionadas em `firestore.rules`, mas precisam ser testadas no Emulator e publicadas explicitamente antes de proteger o projeto remoto.

## Roadmap técnico

1. Documentar e preservar os fluxos atuais.
2. Implementar regras de segurança, propriedade de conteúdo e sanitização.
3. Centralizar Firebase e modularizar o JavaScript.
4. Adicionar qualidade automatizada e testes.
5. Evoluir a experiência de leitores, autores e administradores.
6. Preparar observabilidade, custos, privacidade e escala.
