import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { brl, labelOf, PAYMENT_METHODS, PAYMENT_TERMS } from "@/lib/pf";
import logoAsset from "@/assets/infinitlog-logo.png.asset.json";

// Register a Unicode font so accents render properly.
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2ZL7.woff2", fontWeight: 600 },
  ],
});

const s = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#0d1b4a",
    paddingBottom: 12,
    marginBottom: 12,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 42, height: 42, marginRight: 10 },
  brandName: { fontSize: 16, fontWeight: 700, color: "#0d1b4a" },
  brandTag: { fontSize: 8, color: "#5b6b8a" },
  pfBox: { alignItems: "flex-end" },
  pfCode: { fontSize: 18, fontWeight: 700, color: "#0d1b4a" },
  pfLabel: { fontSize: 8, color: "#5b6b8a", letterSpacing: 1 },
  qr: { width: 78, height: 78, marginTop: 6 },

  section: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
  },
  sectionTitle: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: "#334155",
    textTransform: "uppercase",
  },
  sectionBody: { padding: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingRight: 6, marginBottom: 4 },
  cellFull: { width: "100%", marginBottom: 4 },
  k: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 },
  v: { fontSize: 10, color: "#0f172a", fontWeight: 500 },

  driverRow: { flexDirection: "row" },
  driverPhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
    objectFit: "cover",
    backgroundColor: "#f1f5f9",
  },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  colKind: { flex: 2 },
  colLabel: { flex: 3 },
  colValue: { flex: 1.2, textAlign: "right" },
  th: { fontSize: 8, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  td: { fontSize: 9.5 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 8,
    borderTopWidth: 2,
    borderTopColor: "#0d1b4a",
  },
  totalLabel: { fontSize: 9, color: "#64748b", marginRight: 12, alignSelf: "center" },
  totalValue: { fontSize: 14, fontWeight: 700, color: "#0d1b4a" },

  footer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#64748b",
  },
});

export type FreightProgramPDFProps = {
  program: any;
  order: any;
  driver: any | null;
  driverProfile: any | null;
  vehicle: any | null;
  costs: { kind: string; label?: string | null; amount: number }[];
  responsibleName: string | null;
  qrDataUrl: string;
  trackingUrl: string;
};

export function FreightProgramPDF(p: FreightProgramPDFProps) {
  const total = p.costs.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  return (
    <Document title={p.program.pf_code}>
      <Page size="A4" style={s.page} wrap>
        {/* header */}
        <View style={s.headerRow}>
          <View style={s.brand}>
            <Image src={logoAsset.url} style={s.logo} />
            <View>
              <Text style={s.brandName}>InfinitLog Transportes</Text>
              <Text style={s.brandTag}>Programação de Frete</Text>
            </View>
          </View>
          <View style={s.pfBox}>
            <Text style={s.pfLabel}>Programação</Text>
            <Text style={s.pfCode}>{p.program.pf_code}</Text>
            <Text style={s.brandTag}>
              Pedido {p.order.code} · Rastreio {p.order.tracking_code}
            </Text>
            {p.qrDataUrl ? <Image src={p.qrDataUrl} style={s.qr} /> : null}
          </View>
        </View>

        {/* client */}
        <Section title="Cliente">
          <View style={s.grid}>
            <Cell k="Cliente" v={p.order.client_name} />
            <Cell k="Contato" v={p.order.contact_name} />
            <Cell k="Telefone" v={p.order.contact_phone} />
            <Cell k="Nº do pedido" v={p.order.code} />
            <Cell k="Nota fiscal" v={p.order.invoice_number} />
            <Cell k="Código de rastreio" v={p.order.tracking_code} />
          </View>
        </Section>

        {/* driver */}
        <Section title="Motorista">
          <View style={s.driverRow}>
            {p.driver?.photo_url ? (
              <Image src={p.driver.photo_url} style={s.driverPhoto} />
            ) : (
              <View style={s.driverPhoto} />
            )}
            <View style={{ flex: 1 }}>
              <View style={s.grid}>
                <Cell k="Nome" v={p.driverProfile?.full_name} />
                <Cell k="CPF" v={p.driver?.cpf} />
                <Cell k="Telefone" v={p.driver?.phone ?? p.driverProfile?.phone} />
                <Cell k="Cidade" v={p.driver?.city} />
                <Cell k="CNH" v={p.driver?.license_number} />
                <Cell k="Categoria CNH" v={p.driver?.license_category} />
                <Cell k="Validade CNH" v={p.driver?.cnh_expires_at} />
                <Cell k="RNTRC / ANTT" v={p.driver?.rntrc} />
                <Cell
                  k="Veículo"
                  v={
                    p.vehicle
                      ? `${p.vehicle.brand ?? ""} ${p.vehicle.model ?? ""}`.trim()
                      : null
                  }
                />
                <Cell k="Tipo veículo" v={p.vehicle?.vehicle_type} />
                <Cell k="Placa" v={p.vehicle?.plate} />
                <Cell k="Banco" v={p.driver?.bank_name} />
                <Cell k="Agência" v={p.driver?.bank_agency} />
                <Cell
                  k="Conta"
                  v={
                    p.driver?.bank_account
                      ? `${p.driver.bank_account}${
                          p.driver.bank_account_digit ? "-" + p.driver.bank_account_digit : ""
                        } (${p.driver.bank_account_type ?? "—"})`
                      : null
                  }
                />
                <Cell k="Chave PIX" v={p.driver?.pix_key} />
                <Cell k="Favorecido" v={p.driver?.favored_name} />
                <Cell k="CPF/CNPJ favorecido" v={p.driver?.favored_document} />
              </View>
            </View>
          </View>
        </Section>

        {/* operation */}
        <Section title="Operação">
          <View style={s.grid}>
            <Cell
              k="Origem"
              v={fmtAddress(
                p.order.origin_address,
                p.order.origin_city,
                p.order.origin_state,
                p.order.origin_zip,
              )}
              full
            />
            <Cell
              k="Destino"
              v={fmtAddress(
                p.order.destination_address,
                p.order.destination_city,
                p.order.destination_state,
                p.order.destination_zip,
              )}
              full
            />
            <Cell k="Peso" v={p.order.cargo_weight_kg ? `${p.order.cargo_weight_kg} kg` : null} />
            <Cell k="Volumes" v={p.order.volumes} />
            <Cell k="Cubagem" v={p.order.cargo_volume_m3 ? `${p.order.cargo_volume_m3} m³` : null} />
            <Cell k="Tipo da carga" v={p.order.cargo_type} />
            <Cell k="Valor da NF" v={p.order.invoice_value ? brl(p.order.invoice_value) : null} />
            <Cell
              k="Valor da mercadoria"
              v={p.order.cargo_value_declared ? brl(p.order.cargo_value_declared) : null}
            />
            <Cell k="CT-e" v={p.order.cte_number} />
            <Cell k="MDF-e" v={p.order.mdfe_number} />
            <Cell k="Observações" v={p.order.notes} full />
          </View>
        </Section>

        {/* schedule */}
        <Section title="Programação">
          <View style={s.grid}>
            <Cell k="Data da coleta" v={fmtDT(p.order.pickup_window_start)} />
            <Cell k="Data da entrega" v={fmtDT(p.order.delivery_window_end)} />
            <Cell
              k="Franquia carregamento"
              v={p.order.pickup_franchise_minutes ? `${p.order.pickup_franchise_minutes} min` : null}
            />
            <Cell
              k="Franquia descarga"
              v={
                p.order.delivery_franchise_minutes
                  ? `${p.order.delivery_franchise_minutes} min`
                  : null
              }
            />
            <Cell k="KM da rota" v={p.order.distance_km ? `${p.order.distance_km} km` : null} />
            <Cell
              k="Tempo estimado"
              v={p.order.estimated_minutes ? `${p.order.estimated_minutes} min` : null}
            />
          </View>
        </Section>

        {/* costs */}
        <Section title="Custos da operação">
          <View style={s.tableHead}>
            <Text style={[s.th, s.colKind]}>Item</Text>
            <Text style={[s.th, s.colLabel]}>Descrição</Text>
            <Text style={[s.th, s.colValue]}>Valor</Text>
          </View>
          {p.costs.map((c, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.td, s.colKind]}>{c.kind}</Text>
              <Text style={[s.td, s.colLabel]}>{c.label ?? "—"}</Text>
              <Text style={[s.td, s.colValue]}>{brl(Number(c.amount))}</Text>
            </View>
          ))}
          {p.costs.length === 0 && (
            <View style={s.tableRow}>
              <Text style={[s.td, { flex: 1, color: "#94a3b8" }]}>Nenhum custo lançado.</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL DA OPERAÇÃO</Text>
            <Text style={s.totalValue}>{brl(total)}</Text>
          </View>
        </Section>

        {/* payment */}
        <Section title="Condição de pagamento">
          <View style={s.grid}>
            <Cell k="Valor do frete" v={p.program.freight_value ? brl(p.program.freight_value) : null} />
            <Cell k="Forma" v={labelOf(PAYMENT_METHODS, p.program.payment_method)} />
            <Cell k="Prazo" v={labelOf(PAYMENT_TERMS, p.program.payment_term)} />
            <Cell k="Observações" v={p.program.payment_notes} full />
          </View>
        </Section>

        {/* responsible */}
        <Section title="Responsável">
          <View style={s.grid}>
            <Cell k="Colaborador" v={p.responsibleName} />
            <Cell k="Data / hora" v={fmtDT(p.program.updated_at ?? p.program.created_at)} />
          </View>
        </Section>

        <View style={s.footer}>
          <Text>InfinitLog Transportes · Vamos além do que você precisa</Text>
          <Text>{p.trackingUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function Cell({ k, v, full }: { k: string; v: any; full?: boolean }) {
  const val = v === null || v === undefined || v === "" ? "—" : String(v);
  return (
    <View style={full ? s.cellFull : s.cell}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{val}</Text>
    </View>
  );
}

function fmtAddress(addr?: string | null, city?: string | null, uf?: string | null, zip?: string | null) {
  const parts = [addr, [city, uf].filter(Boolean).join("/"), zip].filter(Boolean);
  return parts.join(" · ") || null;
}

function fmtDT(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR");
}
