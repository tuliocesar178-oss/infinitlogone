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

- Keep canonical individual chat identity as the sorted participant UUID pair in the existing chat_rooms table; preserve legacy room/message IDs via source-room mappings, so history consolidation never duplicates or deletes messages.
- Use the same unified chat workspace for staff and drivers; database RPCs enforce participant access, and legacy multi-party histories remain separate read-only operational context.
