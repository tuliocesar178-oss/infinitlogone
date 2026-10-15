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
- Keep navigation source and casing/line layer identities stable, restoring each independently on style.load and fitting new routes after style readiness; this prevents missing or duplicate road geometry.
- Convert semantic CSS colors to browser-resolved sRGB before passing them to Mapbox paint properties, and restore missing layers at idle when style.load precedes readiness; Mapbox does not parse OKLCH tokens.
- Share structured freight address validation between creation and editing, persist it beside existing coordinates, and invalidate changed-route snapshots in a database trigger; all consumers retain the same endpoint fields.
- Deliver mobile push from persisted notification events through an authenticated event-driven server route, rechecking current recipient access and per-device preferences; per-event/device claims prevent duplicate transport, and browser clients cannot insert notification events or modify delivery metadata.
- Keep the dedicated push messaging worker separate from app-shell cache registration; explicit notification activation can register the messaging-only worker without adding offline caches.

