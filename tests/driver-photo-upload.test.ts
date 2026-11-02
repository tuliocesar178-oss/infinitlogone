import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) }) }),
} }));
import { uploadDriverPhotos } from "../src/lib/driver-photo-upload";
import type { DriverPhotoSelection } from "../src/lib/driver-photo-categories";
const items: DriverPhotoSelection[] = ["a", "b"].map(id => ({ id, category: "chegada_coleta", kind: "chegada_coleta", label: "Chegada ao local de coleta", file: { name: "foto.jpg", type: "image/jpeg", size: 20 } as File }));
describe("envio de fotos por categoria", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.maybeSingle.mockResolvedValue({ data: null, error: null }); mocks.upload.mockResolvedValue({ error: null }); mocks.insert.mockResolvedValue({ error: null }); });
  it("duas fotos inserem dois registros com frete, motorista e categoria corretos", async () => {
    await uploadDriverPhotos(items, "frete-1", "motorista-1", "pickup", null);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ id: "a", order_id: "frete-1", uploaded_by: "motorista-1", kind: "chegada_coleta", event_status: "loaded", metadata: { photo_category: "chegada_coleta" } });
    expect(mocks.insert.mock.calls[1][0].id).toBe("b");
    expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
  });
  it("reenvio de foto já registrada não duplica arquivo nem anexo", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "a", file_path: "frete-1/existente.jpg" }, error: null });
    expect(await uploadDriverPhotos([items[0]], "frete-1", "motorista-1", "delivery", null)).toMatchObject([{ path: "frete-1/existente.jpg" }]);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("falha de armazenamento não registra anexo inexistente", async () => {
    mocks.upload.mockResolvedValue({ error: new Error("Falha de upload") });
    await expect(uploadDriverPhotos([items[0]], "frete-1", "motorista-1", "delivery", null)).rejects.toThrow("Falha de upload");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});