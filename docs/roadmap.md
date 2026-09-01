# Roadmap do Aurora Codex

Este documento registra melhorias aprovadas para avaliação futura. Os itens aqui não estão ativos nem representam contratação de serviços.

## Notificações de novos capítulos por e-mail

**Situação:** melhoria futura, sem implementação ou custos contratados.

**Objetivo:** avisar leitores, autores e administradores quando um capítulo for efetivamente publicado, com capa da obra, identificação do capítulo e convite direto para leitura.

### Experiência desejada

- Banner com a capa da obra.
- Nome da obra, número e título do capítulo.
- Chamada ou resumo opcional.
- Botão que abre diretamente o capítulo publicado.
- Preferências globais e por obra.
- Opção clara para cancelar as notificações.

### Regras essenciais

- Enviar somente após a publicação real, inclusive quando programada.
- Não enviar ao salvar rascunhos ou editar capítulos antigos.
- Exigir consentimento do usuário para comunicações por e-mail.
- Impedir envios duplicados e registrar o histórico de entrega.
- Manter endereços e credenciais fora do frontend e do GitHub Pages.
- Aplicar limites de envio para controlar spam e custos.

### Dependências técnicas

1. Preferências de notificação no perfil do usuário.
2. Publicação programada executada por backend, mesmo sem o portal aberto.
3. Função segura no Firebase para detectar capítulos recém-publicados.
4. Provedor transacional de e-mail, a avaliar entre Resend, Brevo ou SendGrid.
5. Domínio remetente configurado com SPF, DKIM e DMARC.
6. Template responsivo alinhado à identidade visual do Aurora Codex.
7. Atualização detalhada da página **Como funciona** quando a funcionalidade for implementada.

### Fases sugeridas

1. Consentimento e preferências.
2. Automação confiável das publicações programadas.
3. Template e envio controlado de testes.
4. Histórico, prevenção de duplicidade, cancelamento e monitoramento.

