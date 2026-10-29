import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PasswordField } from "./password-field";
import { passwordPairError } from "@/lib/access-credentials";
import { setDriverPasswordDirect } from "@/lib/drivers.functions";
import { activateRegistration } from "@/lib/registration-access.functions";

export interface DriverPasswordDialogProps {
  driverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Lets staff define a new password on the spot for drivers who log in by phone (no mailbox). */
export function DriverPasswordDialog({ driverId, open, onOpenChange }: DriverPasswordDialogProps) {
  const qc = useQueryClient();
  const setPwd = useServerFn(setDriverPasswordDirect);
  const activate = useServerFn(activateRegistration);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordPairError(password, confirm);
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      try {
        await setPwd({ data: { user_id: driverId, password } });
        toast.success("Senha alterada. O motorista já pode entrar com telefone e a nova senha.");
      } catch (err) {
        // No login account yet: create it now with this password (same ID, no duplicate).
        if (!(err instanceof Error && err.message.includes("NO_ACCOUNT"))) throw err;
        await activate({ data: { id: driverId, kind: "driver", email: "", password } });
        await qc.invalidateQueries({ queryKey: ["registration-access", driverId] });
        toast.success("Acesso criado. O motorista já pode entrar com telefone e senha.");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setPassword("");
      setConfirm("");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent>
        <DialogTitle>Definir nova senha</DialogTitle>
        <DialogDescription>
          Este motorista entra com o telefone. Defina a nova senha aqui e passe para ele — nenhum e-mail ou SMS é enviado.
        </DialogDescription>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <PasswordField label="Nova senha" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordField label="Confirmar senha" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar nova senha"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
