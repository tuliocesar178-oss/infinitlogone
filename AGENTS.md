<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Identify individual chats by a unique sorted participant UUID pair in existing chat_rooms; link source rooms without moving or duplicating message IDs to preserve history and attachments.
- Share one chat workspace between staff and driver routes; enforce participant access in database RPCs and restrictive policies, and keep ambiguous legacy histories read-only.
- Resolve freight chat shortcuts through the authorized individual contact directory, preferring the order creator for drivers; never automatically open shared read-only histories as writable chats.
- Store public home appearance in the existing app_settings key through narrow public-read and admin-write RPCs; query previews never change saved settings, keeping operational configuration private.
- Dynamically load the public illustrative map after hydration with no operational data; public visuals must not imply active shipments.
- Compare freight vehicle configurations using registered axle/capacity/bodywork data and the existing ANTT engine; type names without metadata stay unpriced to prevent false official floors. Persist the chosen configuration and calculation snapshot in existing order fields/events.
- Use authenticated driver-owned Mapbox Directions server functions and Turf road projection for web navigation; sync existing telemetry fields without changing freight status, and treat browser background GPS as best-effort rather than native navigation.
- Keep NavigationView connected to useNavigation and lazy-load NavigationMap; a second standalone navigation engine bypasses authenticated directions, telemetry and shared destination rules.
- Keep navigation source and casing/line layer identities stable, restoring each independently on style.load and fitting new routes after style readiness; this prevents missing or duplicate road geometry.
- Convert semantic CSS colors to browser-resolved sRGB before passing them to Mapbox paint properties, and restore missing layers at idle when style.load precedes readiness; Mapbox does not parse OKLCH tokens.
- Share structured freight address validation between creation and editing, persist it beside existing coordinates, and invalidate changed-route snapshots in a database trigger; all consumers retain the same endpoint fields.
- Postal warnings are separate from operational address validation; Mapbox suggestions preserve typed CEP and manual validation only updates the point. Creation, editing and dispatch reuse authenticated confirmed-point Directions; planned route distance never populates recorded mileage.
- Deliver mobile push from persisted notification events through an authenticated event-driven server route, rechecking current recipient access and per-device preferences; per-event/device claims prevent duplicate transport, and browser clients cannot insert notification events or modify delivery metadata.
- Keep the dedicated push messaging worker separate from app-shell cache registration; explicit notification activation can register the messaging-only worker without adding offline caches.
- Extend the existing operation board, TrackingMap and order drawer for TV panels; shared monitoring rules separate contractual deadlines, ping-anchored arrival estimates and actual completion sources, preventing divergent KPIs.
- Persist operational alerts in incidents with stable episode keys and audit actions in order_events; derive detections from authorized historical telemetry on the server, never client-supplied positions.
- Reuse incidents for driver workflows with authorized RPCs, private incident updates/files and event-only GPS; user-scoped IndexedDB drafts retain stable request/file IDs for retry without duplicating records. Keep incident history separate from individual chats, exclude incident queries from persistent query caches and private audit payloads from client reads, and prevent legacy board mutations from changing request-based incidents.

- Role lookups treat a server-rejected session (401) as signed out: refresh once, then sign out locally and send to /auth; never treat a failed lookup as an empty role list, which caused cross-area redirect loops.
- Keep drivers/clients keyed by stable operational identities, independent of Auth account creation; activate with the same UUID to preserve order/work ownership and existing RLS, never relocate historical records. Phone+password login maps the normalized phone to a reserved non-mail Auth e-mail (src/lib/access-credentials.ts) so Supabase Auth still owns password hashing without SMS; never compare passwords manually or replace an existing account.
- Operational registration writes use staff-authenticated functions and database duplicate/approval guards; access provisioning remains admin-only so staff cannot assign privileges.
- Temporary completeness mode lives in app_settings behind authenticated narrow reads and audited admin-only writes; database triggers and server handlers independently enforce its state, so browser changes cannot relax production validation.
- Store works without a required client in staff-only operational_form_drafts until completion; preserve their stable draft IDs rather than inventing relationships or duplicating work records.
- Empty vehicle plate means pending registration, with uniqueness enforced only for known plates; never generate a fictitious plate to persist incomplete vehicle details.
- Never compare float8 coordinates with exact equality in API filters; reads may return fewer digits than stored, so use a 1e-6° tolerance range (~0.1 m) for route concurrency guards.
- Keep commercial order reads behind an authorized read-only view, base-table driver reads column-limited, and driver payment sources independent; database acceptance and margin triggers enforce value integrity without rewriting legacy amounts.
- Operational route maps reuse the authorized operation-board query, shared realtime hook and TrackingMap workspace; paired coordinate/timestamp precedence and configurable deadline rules prevent divergent tracking signals.
- Driver evidence categories map onto existing attachment kinds with category metadata and unique per-photo IDs; camera/gallery selections append files while preserving existing stage confirmation and private storage permissions.
- Push notifications use separate versioned full-color icons and transparent monochrome badges; update the existing messaging registration without replacing subscriptions so Android can render branding correctly.
- Automatic address lookup uses per-field-group debounced identity guards and ordered address/postcode/neighborhood/city fallbacks; approximate results never confirm a route or overwrite typed fields.
- Resolve client ownership through operational_identities in every portal query and restrictive linked-owner policies; Auth UUIDs can differ without moving registrations or historical orders.
- Client history and evidence retain soft-deleted delivered/finalized orders through the same owner-scoped reads; deleted active/cancelled routes stay hidden and are never restored operationally.
- Chat audio uses room/sender-scoped immutable private storage paths, participant-restricted policies and short-lived playback URLs; the existing message RPC links uploads and failed sends clean up unlinked files.
- Push test outcomes read persisted per-device claims; concurrent webhook attempts cannot downgrade accepted delivery, and processing is not reported as failure.
