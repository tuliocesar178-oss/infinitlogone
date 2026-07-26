import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_KINDS, daysUntil, expiryBadgeClass, formatDate } from "@/lib/vehicles";
import { FileText, Upload, Trash2, Download, Plus } from "lucide-react";
import { toast } from "sonner";

export function VehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ kind: "crlv", label: "", expires_at: "" });
  const [file, setFile] = useState<File | null>(null);

  const q = useQuery({
    queryKey: ["vehicle-documents", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_documents")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${vehicleId}/docs/${form.kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vehicle-files").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicleId,
        kind: form.kind,
        label: form.label || null,
        file_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        expires_at: form.expires_at || null,
      });
      if (dbErr) throw dbErr;
      toast.success("Documento anexado");
      setFile(null);
      setForm({ kind: "crlv", label: "", expires_at: "" });
      await qc.invalidateQueries({ queryKey: ["vehicle-documents", vehicleId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from("vehicle-files").createSignedUrl(path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function removeDoc(id: string, path: string) {
    if (!window.confirm("Remover este documento?")) return;
    await supabase.storage.from("vehicle-files").remove([path]);
    await supabase.from("vehicle_documents").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["vehicle-documents", vehicleId] });
    toast.success("Documento removido");
  }

  const rows = (q.data ?? []) as any[];

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <form onSubmit={onUpload} className="card-soft grid gap-3 p-5 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo</label>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
          >
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Rótulo (opcional)</label>
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Validade</label>
          <input
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Arquivo</label>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3 text-sm text-muted-foreground hover:border-brand">
            <Upload className="h-4 w-4" />
            <span className="truncate">{file?.name ?? "Selecionar arquivo"}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {uploading ? "Enviando…" : "Anexar"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        {rows.length === 0 ? (
          <div className="grid place-items-center p-12 text-center text-sm text-muted-foreground">
            <FileText className="mb-3 h-8 w-8 opacity-40" />
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Rótulo</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Enviado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const days = daysUntil(d.expires_at);
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {DOCUMENT_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.label ?? "—"}</td>
                    <td className="px-4 py-3">
                      {d.expires_at ? (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${expiryBadgeClass(days)}`}>
                          {formatDate(d.expires_at)} {days !== null && (days < 0 ? "· vencido" : `· ${days}d`)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openDoc(d.file_path)} className="rounded-lg p-2 hover:bg-accent" title="Abrir">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeDoc(d.id, d.file_path)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="Remover">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
