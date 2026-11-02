import { describe, it, expect } from "vitest";
import { driverPhotoCategories, appendDriverPhotos, driverPhotoPath, type DriverPhotoSelection } from "../src/lib/driver-photo-categories";
describe("categorias de fotos do motorista", () => {
  it("preserva os tipos originais da coleta", () => expect(driverPhotoCategories("pickup").slice(0, 2).map(c => c.kind)).toEqual(["foto_carga", "foto_nf"]));
  it("preserva os tipos originais da entrega", () => expect(driverPhotoCategories("delivery").slice(0, 2).map(c => c.kind)).toEqual(["canhoto", "foto_entrega"]));
  it("adiciona seis categorias em ambos os seletores", () => { for (const stage of ["pickup", "delivery"] as const) expect(driverPhotoCategories(stage).slice(2).map(c => c.value)).toEqual(["chegada_coleta", "carregamento", "nota_fiscal", "chegada_entrega", "carga_entrega", "canhoto_legivel"]); });
  it("carregamento e NF preservam os tipos exigidos pela coleta", () => expect(driverPhotoCategories("pickup").filter(c => ["carregamento", "nota_fiscal"].includes(c.value)).map(c => c.kind)).toEqual(["foto_carga", "foto_nf"]));
  it("canhoto legível preserva o tipo de comprovante existente", () => expect(driverPhotoCategories("delivery").find(c => c.value === "canhoto_legivel")?.kind).toBe("canhoto"));
  it("adicionar duas fotos da mesma categoria não apaga anteriores", () => { const a = { id: "a", kind: "chegada_coleta" } as DriverPhotoSelection; const b = { id: "b", kind: "chegada_coleta" } as DriverPhotoSelection; expect(appendDriverPhotos([a], [b])).toEqual([a, b]); });
  it("mesmo nome de arquivo tem caminhos distintos por foto", () => expect(driverPhotoPath("frete-1", "a", "foto.jpg")).not.toBe(driverPhotoPath("frete-1", "b", "foto.jpg")));
  it("mantém o frete no caminho de armazenamento", () => expect(driverPhotoPath("frete-1", "a", "foto.jpg")).toBe("frete-1/driver-photo-a-foto.jpg"));
});