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

