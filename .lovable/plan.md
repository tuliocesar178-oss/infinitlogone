O módulo **Equipe** é grande — vou entregá-lo em 4 fases funcionais, sem telas "Em Breve". Cada fase é utilizável ao final.

## Fase 1 — Fundação, listagem e convite
- **Banco**: novas tabelas `departments` (8 padrões + livres), `team_members` (cargo, departamento, RG, WhatsApp, endereço, admissão, status ativo/bloqueado, foto, notas), `activity_log` (audit: usuário, ação, entidade, IP, user-agent, data). Extensão de `user_roles` para os papéis novos (`supervisor`, `financeiro`, `comercial`, `operacional`) + RLS de staff.
- **UI**: `/ops/equipe` com cards + lista, busca, filtros (departamento, status, cargo), ordenação, paginação; painel lateral (perfil resumido, atividades recentes); diálogo "Novo colaborador" que dispara convite por e-mail via server function (usa `supabaseAdmin.auth.admin.inviteUserByEmail`, cria profile, team_member, role).
- **Ações**: editar, bloquear/desbloquear, resetar senha, reenviar convite, excluir (admin), abrir perfil.

## Fase 2 — Cadastro completo + permissões granulares
- **Banco**: `permissions_matrix` (16 módulos × 5 ações: visualizar, cadastrar, editar, excluir, exportar) por `user_id`; função `has_permission(_user_id, _module, _action)` (security definer). Presets por papel (Admin, Supervisor, Logística, Financeiro, Comercial, Operacional).
- **UI**: `/ops/equipe/$id` com abas — Pessoais, Endereço, Cargo, Permissões (grid 16×5 com toggles + aplicar preset), Histórico. Upload de foto (bucket `driver-photos` reutilizado como `staff-photos` novo bucket privado). Máscaras CPF/CEP/telefone.
- **Guarda**: hook `usePermission(module, action)` + wrapper de rota; tentativa de acesso sem permissão renderiza `AcessoNegado`.

## Fase 3 — Auditoria, atividades e notificações
- **Banco**: triggers em `orders`, `drivers`, `vehicles`, `incidents`, `deliveries` para gravar em `activity_log` (evento, from/to, actor); tabela `notifications` já existe — adicionar tipos e feed por usuário; função para marcar como lida.
- **UI**: aba Histórico do perfil (com filtros); página `/ops/atividades` global (admin/supervisor); Central de Notificações no header (badge + dropdown, paginado, marcar como lida). Login/logout capturados via `onAuthStateChange` gravando no log.

## Fase 4 — Painel Logística + Chat interno
- **Painel `/ops/logistica`**: cards de KPIs (aguardando cadastro, aguardando motorista, em coleta, em trânsito, próximos, entregues hoje, motoristas disp./em viagem, ocorrências abertas) + mapa em tempo real com posições dos motoristas ativos.
- **Chat interno**: tabela `internal_chats` + `internal_chat_messages` (multi-participante por departamento, e vinculável a `order_id` quando iniciado no frete); anexos via bucket `chat-attachments` (fotos/PDF/áudio/vídeo). UI de chat com realtime Supabase.

## Detalhes técnicos
- Todas as mutações administrativas via `createServerFn` com `requireSupabaseAuth` + verificação de role (nunca chamar admin do client).
- Convites: `supabaseAdmin.auth.admin.inviteUserByEmail` com `redirectTo` para `/auth`. Templates de auth-email já podem ser customizados via `scaffold_auth_email_templates` (posso ativar depois).
- RLS: staff (admin/logistics/supervisor) gerenciam equipe; cada colaborador só vê o próprio perfil e permissões.
- Auditoria: `activity_log` recebe IP e user-agent capturados no server function (via `getRequestHeader`).
- Realtime: notificações e chat via `supabase.channel` em `useEffect`.

## Entrega
Vou implementar a **Fase 1 completa** neste turno (migration + listagem + convite + ações básicas). Ao aprovar cada fase, sigo para a próxima. Confirma?