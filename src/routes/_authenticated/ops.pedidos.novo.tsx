import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useTestMode, readTestMode } from "@/lib/test-mode";
import { loadRegisteredClients } from "@/lib/registered-clients";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Upload, X, Copy, MessageCircle, Mail, MapPin, MessageSquare } from "lucide-react";
import QRCode from "qrcode";
import { shareMessage, trackingUrl } from "@/lib/order-status";
import { AddressFields } from "@/components/addresses/address-fields";
import { emptyAddress, fullAddress, addressError, type FreightAddress } from "@/lib/addresses/model";
import { fetchDrivingRoute } from "@/lib/tracking.functions";
import { sendOffersToEligibleDrivers } from "@/lib/freight-publish";
import {
  ANTT_CARGO_CLASSES,
  ANTT_CONTRACT_TYPES,
  ANTT_OPERATION_TYPES,
  ANTT_AXLE_OPTIONS,
  calculateANTTMinimumFreight,
  type AnttCalculation,
  type AnttContractType,
  type AnttOperationType,
} from "@/lib/antt";
import { AnttCard } from "@/components/freight/antt-card";
import { VehicleCatalog } from "@/components/freight/vehicle-catalog";
import { buildFreightConfigurations, calculateConfigurationFloors, isBodyCompatible, type FreightVehicleConfiguration } from "@/lib/vehicle-antt";
import type { Work } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/ops/pedidos/novo")({
  head: () => ({ meta: [
    { title: "Novo frete — InfinitLog" },
    { name: "description", content: "Cadastro de fretes com comparação de veículos, pisos ANTT vigentes e valores negociados na InfinitLog." },
    { property: "og:title", content: "Novo frete — InfinitLog" },
    { property: "og:description", content: "Compare configurações de veículos e pisos ANTT antes de confirmar o frete." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: NewOrderWizard,
});

type Form = {
  // 1 Cliente
  client_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  company: string;
  purchase_order: string;
  order_number: string;
  client_notes: string;
  // 2 Coleta
  pickup_company: string;
  pickup_contact: string;
  pickup_phone: string;
  pickup_whatsapp: string;
  origin_address: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  origin_neighborhood: string;
  origin_number: string;
  origin_lat: string;
  origin_lng: string;
  pickup_date: string;
  pickup_time: string;
  pickup_franchise_minutes: string;
  pickup_reference: string;
  pickup_dock: string;
  pickup_gate: string;
  pickup_instructions: string;
  // 3 Entrega
  delivery_company: string;
  delivery_contact: string;
  delivery_phone: string;
  delivery_whatsapp: string;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  destination_neighborhood: string;
  destination_number: string;
  destination_lat: string;
  destination_lng: string;
  delivery_date: string;
  delivery_time: string;
  delivery_franchise_minutes: string;
  delivery_reference: string;
  delivery_dock: string;
  delivery_gate: string;
  // 4 Carga
  cargo_weight_kg: string;
  volumes: string;
  cargo_volume_m3: string;
  cargo_type: string;
  cargo_description: string;
  invoice_value: string;
  invoice_number: string;
  cte_number: string;
  mdfe_number: string;
  cargo_notes: string;
  // 5 Custos
  price: string;
  driver_price: string;
  toll: string;
  fuel: string;
  escort: string;
  license: string;
  other_costs: string;
  priority: string;
  // 6 Veículo
  req_vehicle_type: string;
  req_body_type: string;
  req_capacity_kg: string;
  req_axles: string;
  helpers_required: string;
  helpers_count: string;
  tracking_required: string;
  special_requirements: string;
  // extras da carga
  cargo_product: string;
  cargo_package_type: string;
  cargo_dimensions: string;
  operation_type: string;
  offer_minutes: string;
  // ANTT
  antt_cargo_class: string;
  antt_contract_type: string;
  antt_operation_type: string;
  antt_high_performance: string;
  margin_amount: string;
};

const EMPTY: Form = {
  client_name: "", contact_name: "", contact_phone: "", contact_email: "", company: "",
  purchase_order: "", order_number: "", client_notes: "",
  pickup_company: "", pickup_contact: "", pickup_phone: "", pickup_whatsapp: "",
  origin_address: "", origin_city: "", origin_state: "", origin_zip: "",
  origin_neighborhood: "", origin_number: "", origin_lat: "", origin_lng: "",
  pickup_date: "", pickup_time: "", pickup_franchise_minutes: "",
  pickup_reference: "", pickup_dock: "", pickup_gate: "", pickup_instructions: "",
  delivery_company: "", delivery_contact: "", delivery_phone: "", delivery_whatsapp: "",
  destination_address: "", destination_city: "", destination_state: "", destination_zip: "",
  destination_neighborhood: "", destination_number: "", destination_lat: "", destination_lng: "",
  delivery_date: "", delivery_time: "", delivery_franchise_minutes: "",
  delivery_reference: "", delivery_dock: "", delivery_gate: "",
  cargo_weight_kg: "", volumes: "", cargo_volume_m3: "", cargo_type: "",
  cargo_description: "", invoice_value: "", invoice_number: "", cte_number: "", mdfe_number: "",
  cargo_notes: "",
  price: "", driver_price: "", toll: "", fuel: "", escort: "", license: "", other_costs: "",
  priority: "normal",
  req_vehicle_type: "", req_body_type: "", req_capacity_kg: "", req_axles: "",
  helpers_required: "nao", helpers_count: "", tracking_required: "sim", special_requirements: "",
  cargo_product: "", cargo_package_type: "", cargo_dimensions: "", operation_type: "",
  offer_minutes: "15",
  antt_cargo_class: "carga_geral", antt_contract_type: "composicao",
  antt_operation_type: "lotacao", antt_high_performance: "nao", margin_amount: "",
};

export const VEHICLE_TYPES = ["Fiorino", "Van", "VUC", "3/4", "Toco", "Truck", "Carreta", "Bitrem", "Rodotrem", "Outro"];
export const BODY_TYPES = ["Baú", "Sider", "Aberta", "Graneleiro", "Frigorífica", "Tanque", "Prancha", "Outra"];

const STEPS = ["Cliente", "Coleta", "Entrega", "Carga", "Veículo", "Valores", "Documentos", "Revisão"] as const;

function combineDateTime(d: string, t: string): string | null {
  if (!d) return null;
  const iso = t ? `${d}T${t}:00` : `${d}T00:00:00`;
  return new Date(iso).toISOString();
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function NewOrderWizard() {
  const navigate = useNavigate();
  const mode = useTestMode();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [files, setFiles] = useState<{ file: File; kind: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ id: string; company_name: string; cnpj: string; full_name: string; phone: string; whatsapp: string; email: string; zip_code: string; address: string; address_number: string; neighborhood: string; city: string; state: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>("");
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    code: string;
    tracking_code: string;
    qr: string;
  } | null>(null);

  const [addressDetails, setAddressDetails] = useState<{origin: FreightAddress; destination: FreightAddress}>({ origin: {...emptyAddress}, destination: {...emptyAddress} });
  function addressValue(type: 'origin'|'destination'): FreightAddress {
    const d=addressDetails[type];
    return {...d,street:f[`${type}_address`],number:f[`${type}_number`],city:f[`${type}_city`],state:f[`${type}_state`],zip:f[`${type}_zip`],neighborhood:f[`${type}_neighborhood`],reference:type==='origin'?f.pickup_reference:f.delivery_reference,lat:d.precision==='unconfirmed'?null:num(f[`${type}_lat`]),lng:d.precision==='unconfirmed'?null:num(f[`${type}_lng`])};
  }
  function updateAddress(type:'origin'|'destination', a:FreightAddress) {
    setRouteInfo(null);
    setAddressDetails(s=>({...s,[type]:a}));
    setF(s=>({...s,[`${type}_address`]:a.street,[`${type}_number`]:a.number,[`${type}_city`]:a.city,[`${type}_state`]:a.state,[`${type}_zip`]:a.zip,[`${type}_neighborhood`]:a.neighborhood,[`${type}_lat`]:a.lat==null?'':String(a.lat),[`${type}_lng`]:a.lng==null?'':String(a.lng),[type==='origin'?'pickup_reference':'delivery_reference']:a.reference}));
  }
  function set<K extends keyof Form>(k: K, v: string) {
    if (k === "req_vehicle_type") setSelectedVehicleKey(null);
    setF((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorks() {
      setWorks([]);
      setSelectedWorkId("");

      if (!selectedClientId) return;

      setLoadingWorks(true);
      try {
        const { data, error } = await supabase
          .from("works")
          .select("*")
          .eq("client_id", selectedClientId)
          .in("status", ["active", "paused"])
          .order("name");

        if (error) throw error;
        if (!cancelled) setWorks((data ?? []) as Work[]);
      } catch (error) {
        console.error("Erro ao carregar obras:", error);
        if (!cancelled) toast.error("Não foi possível carregar as obras do cliente.");
      } finally {
        if (!cancelled) setLoadingWorks(false);
      }
    }

    void loadWorks();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  useEffect(() => {
    const work = works.find((item) => item.id === selectedWorkId);
    if (!work) return;

    setAddressDetails(current => ({...current,destination:{...current.destination,precision:'unconfirmed',lat:null,lng:null}}));
    setF((current) => ({
      ...current,
      destination_address: current.destination_address || work.address || "",
      destination_number: current.destination_number || work.number || "",
      destination_city: current.destination_city || work.city || "",
      destination_state: current.destination_state || work.state || "",
      destination_zip: current.destination_zip || work.zip_code || "",
      destination_neighborhood: current.destination_neighborhood || work.neighborhood || "",
      destination_lat: "",
      destination_lng: "",
    }));
  }, [selectedWorkId, works]);

  useEffect(() => {
    loadRegisteredClients().then(setClients).catch(() => toast.error("Não foi possível consultar clientes cadastrados."));
  }, []);

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setF(s => ({
        ...s,
        client_name: client.full_name || s.client_name,
        company: client.company_name || s.company,
        contact_name: client.full_name || s.contact_name,
        contact_phone: client.phone || s.contact_phone,
        contact_email: client.email || s.contact_email,
        client_notes: `CNPJ: ${client.cnpj || ""}\nWhatsApp: ${client.whatsapp || ""}`,
        origin_city: client.city || s.origin_city,
        origin_state: client.state || s.origin_state,
        origin_zip: client.zip_code || s.origin_zip,
        origin_neighborhood: client.neighborhood || s.origin_neighborhood,
        origin_number: client.address_number || s.origin_number,
      }));
    } else if (!clientId) {
      // Reset logic if needed, but usually we just leave it or clear if it was an explicit "unselect"
      setSelectedClientId("");
    }
  }

  const totalCost = ["driver_price", "toll", "fuel", "escort", "license", "other_costs"]
    .reduce((s, k) => s + (num(f[k as keyof Form] as string) ?? 0), 0);
  const revenue = num(f.price) ?? 0;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  function canAdvance(): string | null {
    if (mode.enabled) return null;
    if (step === 0 && !f.client_name.trim()) return "Informe o nome do cliente";
    if (step === 0 && works.length > 0 && !selectedWorkId) {
      return "Selecione a obra de destino";
    }
    if (step === 1) { const e=addressError(addressValue("origin")); if(e) return `Coleta: ${e}`; }
    if (step === 2) { const e=addressError(addressValue("destination")); if(e) return `Entrega: ${e}`; }
    if (step === 5 && !hasEffectiveConfiguration()) return "Escolha a configuração efetiva do veículo e informe os eixos";
    if (step === 5 && !isBodyCompatible(selectedVehicle, f.req_body_type)) return "Escolha uma carroceria compatível";
    if (step === 5 && !f.price) return "Informe o valor cobrado do cliente";
    return null;
  }

  const [routeInfo, setRouteInfo] = useState<{
    distance_km: number;
    duration_minutes: number;
    geometry: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRouteInfo(null);
    async function calc() {
      if (addressError(addressValue('origin')) || addressError(addressValue('destination'))) return;
      try {
        const route = await fetchDrivingRoute({data:{fromLat:Number(f.origin_lat),fromLng:Number(f.origin_lng),toLat:Number(f.destination_lat),toLng:Number(f.destination_lng)}});
        if (!cancelled && route.geometry && route.distance != null && route.duration != null) setRouteInfo({distance_km:route.distance,duration_minutes:route.duration,geometry:JSON.stringify(route.geometry)});
      } catch (error) {
        if (!cancelled) toast.error("Não foi possível calcular a distância da rota.");
      }
    }
    void calc();
    return () => { cancelled = true; };
  }, [f.origin_lat, f.origin_lng, f.destination_lat, f.destination_lng, addressDetails.origin, addressDetails.destination]);

  // ---- Cálculo do piso mínimo ANTT (coeficientes vindos da tabela vigente) ----
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | null>(null);
  const vehicleCatalog = useQuery({
    queryKey: ["freight-vehicle-configurations"],
    queryFn: async () => {
      const [vehicles, types] = await Promise.all([
        supabase.from("vehicles").select("id,vehicle_type,axles,capacity_kg,body_type").eq("active", true),
        supabase.from("vehicle_types").select("name").eq("active", true).order("name"),
      ]);
      if (vehicles.error) throw vehicles.error;
      if (types.error) throw types.error;
      const registered = vehicles.data ?? [];
      const names = types.data ?? [];
      // Type names have no axle metadata and cannot provide a price by themselves.
      return buildFreightConfigurations([...registered, ...names
        .filter((type) => !registered.some((vehicle) => vehicle.vehicle_type === type.name))
        .map((type) => ({ id: `type:${type.name}`, vehicle_type: type.name, axles: null, capacity_kg: null, body_type: null }))]);
    },
    staleTime: 60_000,
  });
  const configurations = useMemo(() => vehicleCatalog.data ?? buildFreightConfigurations([]), [vehicleCatalog.data]);
  const selectedBase = configurations.find((item) => item.key === selectedVehicleKey);
  const selectedVehicle: FreightVehicleConfiguration | null = selectedBase && selectedBase.value === f.req_vehicle_type
    ? { ...selectedBase, axles: Number(f.req_axles) || null }
    : f.req_vehicle_type ? { key: "manual", label: f.req_vehicle_type, value: f.req_vehicle_type, axles: Number(f.req_axles) || null, capacity: num(f.req_capacity_kg), bodyTypes: [], registered: false } : null;
  const anttDistance = routeInfo?.distance_km ?? 0;
  const anttAxles = Number(f.req_axles) || 0;
  const calculationInput = {
    distance_km: anttDistance, cargo_class: f.antt_cargo_class,
    contract_type: f.antt_contract_type as AnttContractType,
    high_performance: f.antt_high_performance === "sim",
    operation_type: f.antt_operation_type as AnttOperationType,
  };
  const comparisonConfigurations = useMemo(() => configurations.map((item) => item.key === selectedVehicleKey && anttAxles
    ? { ...item, axles: anttAxles } : item), [configurations, selectedVehicleKey, anttAxles]);
  const floors = useQuery({
    queryKey: ["freight-configuration-floors", comparisonConfigurations, calculationInput],
    queryFn: () => calculateConfigurationFloors(comparisonConfigurations, calculationInput, calculateANTTMinimumFreight),
    enabled: step === 5 && anttDistance > 0,
    staleTime: 30_000,
  });
  const selectedCalculation = useQuery({
    queryKey: ["freight-selected-antt", calculationInput, anttAxles],
    queryFn: () => calculateANTTMinimumFreight({ ...calculationInput, axles: anttAxles }),
    enabled: anttDistance > 0 && anttAxles > 0,
    staleTime: 30_000,
  });
  const antt: AnttCalculation | null = anttDistance > 0 && anttAxles > 0 ? selectedCalculation.data ?? null : null;
  const anttLoading = selectedCalculation.isFetching;
  const bodyTypes = [...new Set([...BODY_TYPES, ...configurations.flatMap((item) => item.bodyTypes)])];
  function hasEffectiveConfiguration() { return !!selectedVehicle && Number.isInteger(anttAxles) && anttAxles > 0; }
  function selectVehicle(vehicle: FreightVehicleConfiguration) {
    setSelectedVehicleKey(vehicle.key);
    setF((current) => ({ ...current, req_vehicle_type: vehicle.value,
      req_axles: vehicle.axles ? String(vehicle.axles) : "",
      req_capacity_kg: vehicle.capacity ? String(vehicle.capacity) : current.req_capacity_kg,
    }));
  }

  const tolls = num(f.toll) ?? 0;
  const extraCosts = (num(f.fuel) ?? 0) + (num(f.escort) ?? 0) + (num(f.license) ?? 0) + (num(f.other_costs) ?? 0);
  const marginAmount = num(f.margin_amount) ?? 0;
  const negotiated = num(f.driver_price) ?? num(f.price) ?? 0;
  const clientFreightValue = num(f.price) ?? 0;
  const suggestedValue = (antt?.minimum_freight ?? 0) + tolls + extraCosts + marginAmount;
  const belowFloor =
    !!antt?.applicable &&
    antt.minimum_freight !== null &&
    negotiated > 0 &&
    negotiated < antt.minimum_freight;

  function next() {
    const err = canAdvance();
    if (err) return toast.error(err);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function save(publish: boolean) {
    const err = canAdvance();
    if (err) return toast.error(err);
    let testMode = false;
    try { testMode = await readTestMode(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível conferir as exigências.'); return; }
    if (!testMode) for(const type of ['origin','destination'] as const){const problem=addressError(addressValue(type));if(problem)return toast.error(`${type==='origin'?'Coleta':'Entrega'}: ${problem}`);}
    if(publish && !testMode && !routeInfo)return toast.error('Aguarde o cálculo da rota ou confira os pontos de coleta e entrega.');
    // Bloqueio legal: não é permitido publicar carga lotação abaixo do piso mínimo ANTT.
    if (publish && belowFloor && antt?.minimum_freight != null) {
      return toast.error(
        `Valor abaixo do piso mínimo ANTT (${brl(antt.minimum_freight)}). Ajuste o valor do motorista ou reclassifique a operação.`,
      );
    }
    if (publish && !testMode && !hasEffectiveConfiguration()) return toast.error("Escolha a configuração efetiva do veículo e informe os eixos.");
    if (!testMode && !isBodyCompatible(selectedVehicle, f.req_body_type)) return toast.error("Escolha uma carroceria compatível.");
    if (!testMode && selectedCalculation.isFetching) return toast.warning("Aguarde o cálculo ANTT terminar.");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const canOffer = publish && routeInfo !== null && (num(f.driver_price) ?? num(f.price) ?? 0) > 0;
      const payload = {
        client_id: selectedClientId || null,
        work_id: selectedWorkId || null,
        recorded_distance_km: null,
        antt_applicable: antt?.applicable ?? null,
        antt_not_applicable_reason: antt?.not_applicable_reason ?? null,
        antt_cargo_class: f.antt_cargo_class || null,
        antt_axles: Number(f.req_axles) || null,
        antt_contract_type: f.antt_contract_type || null,
        antt_high_performance: f.antt_high_performance === "sim",
        antt_table: antt?.table ?? null,
        antt_ccd: antt?.ccd ?? null,
        antt_cc: antt?.cc ?? null,
        antt_distance_km: antt?.distance_km ?? routeInfo?.distance_km ?? null,
        antt_minimum_value: antt?.minimum_freight ?? null,
        antt_resolution: antt?.regulation ?? null,
        antt_effective_date: antt?.effective_from ?? null,
        antt_calculated_at: antt?.status === "ok" ? antt.calculation_date : null,
        antt_rate_table_id: antt?.rate_table_id ?? null,
        suggested_value: antt?.minimum_freight != null && suggestedValue > 0 ? suggestedValue : null,
        margin_amount: marginAmount || null,
        client_name: f.client_name || null,
        contact_name: f.contact_name || null,
        contact_phone: f.contact_phone || null,
        origin_address: fullAddress(addressValue("origin")),
        origin_location_details: addressValue("origin"),
        origin_city: f.origin_city || null,
        origin_state: f.origin_state || null,
        origin_zip: f.origin_zip || null,
        origin_neighborhood: f.origin_neighborhood || null,
        origin_number: f.origin_number || null,
        origin_lat: num(f.origin_lat),
        origin_lng: num(f.origin_lng),
        destination_address: fullAddress(addressValue("destination")),
        destination_location_details: addressValue("destination"),
        destination_city: f.destination_city || null,
        destination_state: f.destination_state || null,
        destination_zip: f.destination_zip || null,
        destination_neighborhood: f.destination_neighborhood || null,
        destination_number: f.destination_number || null,
        destination_lat: num(f.destination_lat),
        destination_lng: num(f.destination_lng),
        pickup_reference: f.pickup_reference || null,
        pickup_dock: f.pickup_dock || null,
        pickup_gate: f.pickup_gate || null,
        pickup_instructions: f.pickup_instructions || null,
        delivery_reference: f.delivery_reference || null,
        delivery_dock: f.delivery_dock || null,
        delivery_gate: f.delivery_gate || null,
        cargo_description: f.cargo_description || null,
        cargo_weight_kg: num(f.cargo_weight_kg),
        cargo_volume_m3: num(f.cargo_volume_m3),
        cargo_value: num(f.invoice_value),
        cargo_value_declared: num(f.invoice_value),
        invoice_value: num(f.invoice_value),
        invoice_number: f.invoice_number || null,
        cte_number: f.cte_number || null,
        mdfe_number: f.mdfe_number || null,
        volumes: f.volumes ? Number(f.volumes) : null,
        cargo_type: f.cargo_type || null,
        price: num(f.price),
        pickup_window_start: combineDateTime(f.pickup_date, f.pickup_time),
        pickup_window_end: combineDateTime(f.pickup_date, f.pickup_time),
        delivery_window_start: combineDateTime(f.delivery_date, f.delivery_time),
        delivery_window_end: combineDateTime(f.delivery_date, f.delivery_time),
        pickup_franchise_minutes: f.pickup_franchise_minutes ? Number(f.pickup_franchise_minutes) : null,
        delivery_franchise_minutes: f.delivery_franchise_minutes ? Number(f.delivery_franchise_minutes) : null,
        priority: f.priority,
        notes: [f.client_notes, f.cargo_notes].filter(Boolean).join("\n\n") || null,
        status: (canOffer ? "awaiting_driver" : "planning") as never,
        published_at: canOffer ? new Date().toISOString() : null,
        created_by: u.user?.id ?? null,
        distance_km: routeInfo?.distance_km ?? null,
        estimated_minutes: routeInfo?.duration_minutes ?? null,
        route_geometry: routeInfo?.geometry ?? null,
        estimated_tolls: num(f.toll),
        // Carga complementar
        cargo_product: f.cargo_product || null,
        cargo_package_type: f.cargo_package_type || null,
        cargo_dimensions: f.cargo_dimensions || null,
        purchase_order: f.purchase_order || null,
        operation_type: f.operation_type || null,
        // Veículo exigido
        required_vehicle_type: f.req_vehicle_type || null,
        required_body_type: f.req_body_type || null,
        required_capacity_kg: num(f.req_capacity_kg),
        required_axles: f.req_axles ? Number(f.req_axles) : null,
        helpers_required: f.helpers_required === "sim",
        helpers_count: f.helpers_count ? Number(f.helpers_count) : null,
        tracking_required: f.tracking_required !== "nao",
        special_requirements: f.special_requirements || null,
        // Financeiro
        fuel_cost: num(f.fuel),
        other_costs: num(f.other_costs),
        driver_amount: num(f.driver_price),
        client_amount: num(f.price),
        offer_expires_minutes: f.offer_minutes ? Number(f.offer_minutes) : 15,
        // Contatos
        pickup_contact_name: f.pickup_contact || null,
        pickup_phone: f.pickup_phone || f.pickup_whatsapp || null,
        pickup_whatsapp: f.pickup_whatsapp || null,
        delivery_contact_name: f.delivery_contact || null,
        delivery_phone: f.delivery_phone || f.delivery_whatsapp || null,
        delivery_whatsapp: f.delivery_whatsapp || null,
      };
      const { data: order, error } = await supabase
        .from("orders").insert(payload).select("id, code, tracking_code").single();
      
      if (error) {
        console.error("Supabase order insert error:", error);
        // Se for erro de RLS (pode acontecer se o role demorar a propagar ou política falhar)
        if (error.code === '42501') {
           throw new Error("Permissão negada ao salvar pedido. Verifique se você tem perfil administrativo ativo.");
        }
        throw error;
      }

      // Create chat room for oxygenated operation
      try {
        await supabase.from('chat_rooms').upsert({ order_id: order.id }, { onConflict: 'order_id' });
      } catch (ce) {
        console.error("Error creating chat room:", ce);
      }

      // Espera a PF ser criada pelo trigger e grava custos
      // Usamos uma pequena espera ou retry pois triggers podem levar milissegundos
      let programData = null;
      for (let i = 0; i < 5; i++) {
        const { data: p } = await supabase
          .from("freight_programs").select("id").eq("order_id", order.id).maybeSingle();
        if (p) {
          programData = p;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (programData) {
        const costs = [
          { kind: "frete", amount: num(f.driver_price) },
          { kind: "pedagio", amount: num(f.toll) },
          { kind: "combustivel", amount: num(f.fuel) },
          { kind: "batedor", amount: num(f.escort) },
          { kind: "licenca", amount: num(f.license) },
          { kind: "outros", amount: num(f.other_costs) },
        ].filter((c) => c.amount != null && c.amount > 0)
         .map((c) => ({ 
           program_id: programData.id, 
           kind: c.kind as any, 
           amount: c.amount 
         }));
        
        if (costs.length) {
          const { error: costsError } = await supabase.from("freight_costs").insert(costs as any);
          if (costsError) {
            console.error("Erro ao inserir custos:", costsError);
          }
        }

        if (num(f.driver_price)) {
          const { error: progUpdateError } = await supabase.from("freight_programs")
            .update({ freight_value: num(f.driver_price) })
            .eq("id", programData.id);
          if (progUpdateError) {
            console.error("Erro ao atualizar valor do frete na PF:", progUpdateError);
          }
        }
      }

      // Upload de anexos
      for (const it of files) {
        const path = `${order.id}/${Date.now()}-${it.file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("order-files").upload(path, it.file, {
          upsert: false, contentType: it.file.type,
        });
        if (up.error) { toast.warning(`Frete salvo; anexo pendente: ${it.file.name}`); continue; }
        await supabase.from("order_attachments").insert({
          order_id: order.id, kind: it.kind, label: it.file.name,
          file_path: path, mime_type: it.file.type, size_bytes: it.file.size,
          uploaded_by: u.user?.id ?? null,
        });
      }

      await supabase.from("order_events").insert({
        order_id: order.id, event_type: "order_created",
        to_status: (canOffer ? "awaiting_driver" : "planning") as never, actor_id: u.user?.id ?? null,
        payload: { vehicle_configuration: selectedVehicle ? { name: selectedVehicle.label, axles: anttAxles, capacity_kg: num(f.req_capacity_kg), body_type: f.req_body_type || null } : null,
          antt_calculation: antt, suggested_value: suggestedValue, negotiated_value: num(f.price) },
      });

      let offersSent = 0;
      if (canOffer) {
        offersSent = await sendOffersToEligibleDrivers(order.id, {
          price: num(f.driver_price) ?? num(f.price) ?? 0,
          minutes: f.offer_minutes ? Number(f.offer_minutes) : 15,
          vehicleType: f.req_vehicle_type,
          capacityKg: num(f.req_capacity_kg),
          code: order.code,
        });
        await supabase.from("order_events").insert({
          order_id: order.id, event_type: "order_published",
          to_status: "awaiting_driver" as any, actor_id: u.user?.id ?? null,
          payload: { offers: offersSent } as any,
        });
      }

      const qr = await QRCode.toDataURL(trackingUrl(order.tracking_code), { margin: 1, width: 220 });
      setResult({ id: order.id, code: order.code, tracking_code: order.tracking_code, qr });
      toast.success(
        canOffer
          ? `Frete ${order.code} publicado — ${offersSent} motorista(s) notificado(s)`
          : `Rascunho do frete ${order.code} salvo`,
      );
    } catch (e: any) {
      console.error("Erro detalhado ao salvar frete:", e);
      const msg = e.message || (e.error_description) || "Erro desconhecido ao salvar frete";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const link = trackingUrl(result.tracking_code);
    const msg = shareMessage(result.tracking_code);
    return (
      <AppShell title="Frete criado" subtitle={`${result.code} · rastreio ${result.tracking_code}`}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="card-soft p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">{routeInfo ? "Frete salvo" : "Frete salvo · Rota pendente"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compartilhe o rastreio com o cliente ou envie oferta agora.</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <img src={result.qr} alt="QR Code" className="rounded-2xl border border-border p-3" />
              <div className="font-mono text-sm">{result.tracking_code}</div>
              <div className="break-all text-xs text-muted-foreground">{link}</div>
            </div>

            {routeInfo && (
              <div className="mt-6 border-y border-border py-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <div className="h-10 w-px bg-border" />
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coleta</div>
                      <div className="font-semibold text-sm">{f.pickup_company || "Empresa não informada"} · {f.origin_city}/{f.origin_state}</div>
                      <div className="text-xs text-muted-foreground">{f.pickup_date} às {f.pickup_time}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entrega</div>
                      <div className="font-semibold text-sm">{f.delivery_company || "Empresa não informada"} · {f.destination_city}/{f.destination_state}</div>
                      <div className="text-xs text-muted-foreground">{f.delivery_date} às {f.delivery_time}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-around rounded-xl bg-surface-2 p-3 text-center">
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Distância</div>
                    <div className="text-sm font-bold">{routeInfo.distance_km} km</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Tempo</div>
                    <div className="text-sm font-bold">{Math.floor(routeInfo.duration_minutes / 60)}h{routeInfo.duration_minutes % 60}m</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Pedágios</div>
                    <div className="text-sm font-bold">{num(f.toll) == null ? "Não informado" : brl(Number(num(f.toll)))}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent">
                <Copy className="h-4 w-4" /> Copiar link
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href={`mailto:?subject=Rastreio do seu frete&body=${encodeURIComponent(msg)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent">
                <Mail className="h-4 w-4" /> E-mail
              </a>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to={"/ops/chat" as any} search={{ orderId: result.id } as any}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/20">
                <MessageSquare className="h-4 w-4" /> Ir para o Chat
              </Link>
              <Link to="/ops/pedidos/$id" params={{ id: result.id }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Despachar agora <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ops"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold hover:bg-accent">
                Voltar ao dashboard
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Novo frete"
      subtitle={`Etapa ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}
      actions={
        <Link to="/ops" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      {!routeInfo && <p className="mb-4 text-sm text-warning">Rota pendente · distância e duração não calculadas</p>}
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : null)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                i === step
                  ? "bg-brand text-brand-foreground"
                  : i < step
                    ? "bg-brand/10 text-brand hover:bg-brand/20"
                    : "bg-surface-2 text-muted-foreground"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/40">›</span>}
          </li>
        ))}
      </ol>

      <div className="card-soft p-6 sm:p-8">
        {step === 0 && (
          <Grid>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Selecionar Cliente Cadastrado
                </span>
                <select 
                  value={selectedClientId} 
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand appearance-none"
                >
                  <option value="">— Selecionar Cliente (Opcional) —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.full_name || "Sem Nome"} {c.cnpj ? `(${c.cnpj})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <T label="Nome do Cliente" required={!mode.enabled} value={f.client_name} onChange={(v) => set("client_name", v)} />

            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Obra de destino
                  {works.length > 0 && <span className="ml-1 text-destructive">*</span>}
                </span>

                <select
                  value={selectedWorkId}
                  disabled={!selectedClientId || loadingWorks}
                  onChange={(event) => setSelectedWorkId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!selectedClientId
                      ? "Selecione primeiro o cliente"
                      : loadingWorks
                        ? "Carregando obras..."
                        : works.length === 0
                          ? "Este cliente ainda não possui obras cadastradas"
                          : "Selecione a obra de destino"}
                  </option>
                  {works.map((work) => (
                    <option key={work.id} value={work.id}>
                      {work.name}{work.code ? ` · ${work.code}` : ""}
                    </option>
                  ))}
                </select>

                {selectedClientId && !loadingWorks && works.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Cadastre uma obra para tornar este frete rastreável por projeto.
                  </p>
                )}
              </label>
            </div>

            <T label="Empresa não informada" value={f.company} onChange={(v) => set("company", v)} />
            <T label="Contato" value={f.contact_name} onChange={(v) => set("contact_name", v)} />
            <T label="Telefone" value={f.contact_phone} onChange={(v) => set("contact_phone", v)} />
            <T label="E-mail" type="email" value={f.contact_email} onChange={(v) => set("contact_email", v)} />
            <T label="Ordem de compra (OC)" value={f.purchase_order} onChange={(v) => set("purchase_order", v)} />
            <T label="Nº do pedido" value={f.order_number} onChange={(v) => set("order_number", v)} />
            <T label="Observações" value={f.client_notes} onChange={(v) => set("client_notes", v)} full />
          </Grid>
        )}

        {step === 1 && (
          <Grid>
            <T label="Empresa da coleta" value={f.pickup_company} onChange={(v) => set("pickup_company", v)} />
            <T label="Responsável" value={f.pickup_contact} onChange={(v) => set("pickup_contact", v)} />
            <T label="WhatsApp" value={f.pickup_whatsapp} onChange={(v) => set("pickup_whatsapp", v)} />
            <div className="sm:col-span-2"><AddressFields label="Endereço de coleta" value={addressValue("origin")} onChange={a=>updateAddress("origin",a)} /></div>
            <T label="Data da coleta" type="date" value={f.pickup_date} onChange={(v) => set("pickup_date", v)} />
            <T label="Hora" type="time" value={f.pickup_time} onChange={(v) => set("pickup_time", v)} />
            <T label="Doca" value={f.pickup_dock} onChange={(v) => set("pickup_dock", v)} />
            <T label="Portaria" value={f.pickup_gate} onChange={(v) => set("pickup_gate", v)} />
            <T label="Instruções" value={f.pickup_instructions} onChange={(v) => set("pickup_instructions", v)} full />
          </Grid>
        )}

        {step === 2 && (
          <Grid>
            <T label="Empresa da entrega" value={f.delivery_company} onChange={(v) => set("delivery_company", v)} />
            <T label="Responsável" value={f.delivery_contact} onChange={(v) => set("delivery_contact", v)} />
            <T label="WhatsApp" value={f.delivery_whatsapp} onChange={(v) => set("delivery_whatsapp", v)} />
            <div className="sm:col-span-2"><AddressFields label="Endereço de entrega" value={addressValue("destination")} onChange={a=>updateAddress("destination",a)} /></div>
            <T label="Data prevista" type="date" value={f.delivery_date} onChange={(v) => set("delivery_date", v)} />
            <T label="Hora prevista" type="time" value={f.delivery_time} onChange={(v) => set("delivery_time", v)} />
            <T label="Doca" value={f.delivery_dock} onChange={(v) => set("delivery_dock", v)} />
            <T label="Portaria" value={f.delivery_gate} onChange={(v) => set("delivery_gate", v)} />
          </Grid>
        )}

        {step === 3 && (
          <Grid>
            <T label="Tipo de carga" value={f.cargo_type} onChange={(v) => set("cargo_type", v)} />
            <T label="Produto" value={f.cargo_product} onChange={(v) => set("cargo_product", v)} />
            <T label="Peso (kg)" type="number" value={f.cargo_weight_kg} onChange={(v) => set("cargo_weight_kg", v)} />
            <T label="Unidade / cubagem (m³)" type="number" value={f.cargo_volume_m3} onChange={(v) => set("cargo_volume_m3", v)} />
            <T label="Quantidade de volumes" type="number" value={f.volumes} onChange={(v) => set("volumes", v)} />
            <T label="Tipo de volume" value={f.cargo_package_type} onChange={(v) => set("cargo_package_type", v)} />
            <T label="Dimensões (C x L x A)" value={f.cargo_dimensions} onChange={(v) => set("cargo_dimensions", v)} />
            <T label="Tipo de operação" value={f.operation_type} onChange={(v) => set("operation_type", v)} />
            <T label="Descrição da carga" value={f.cargo_description} onChange={(v) => set("cargo_description", v)} full />
            <T label="Valor da nota fiscal" type="number" value={f.invoice_value} onChange={(v) => set("invoice_value", v)} />
            <T label="Nº da nota fiscal" value={f.invoice_number} onChange={(v) => set("invoice_number", v)} />
            <T label="Nº do pedido / OC" value={f.purchase_order} onChange={(v) => set("purchase_order", v)} />
            <T label="CT-e" value={f.cte_number} onChange={(v) => set("cte_number", v)} />
            <T label="MDF-e" value={f.mdfe_number} onChange={(v) => set("mdfe_number", v)} />
            <T label="Observações" value={f.cargo_notes} onChange={(v) => set("cargo_notes", v)} full />
          </Grid>
        )}

        {step === 4 && (
          <Grid>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo de veículo</span>
              <select value={f.req_vehicle_type} onChange={(e) => set("req_vehicle_type", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                <option value="">Indiferente</option>
                {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo de carroceria</span>
              <select value={f.req_body_type} onChange={(e) => set("req_body_type", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                <option value="">Indiferente</option>
                {BODY_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <T label="Capacidade mínima (kg)" type="number" value={f.req_capacity_kg} onChange={(v) => set("req_capacity_kg", v)} />
            <T label="Quantidade de eixos" type="number" value={f.req_axles} onChange={(v) => set("req_axles", v)} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Necessita ajudante?</span>
              <select value={f.helpers_required} onChange={(e) => set("helpers_required", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </label>
            <T label="Quantidade de ajudantes" type="number" value={f.helpers_count} onChange={(v) => set("helpers_count", v)} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Necessita rastreamento?</span>
              <select value={f.tracking_required} onChange={(e) => set("tracking_required", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <T label="Validade da oferta (min)" type="number" value={f.offer_minutes} onChange={(v) => set("offer_minutes", v)} />
            <T label="Exigências especiais" value={f.special_requirements} onChange={(v) => set("special_requirements", v)} full />
          </Grid>
        )}

        {step === 5 && (
          <>
            <div className="mb-4 grid gap-2 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 text-sm text-muted-foreground">{f.origin_city || f.origin_address || "Origem"} → {f.destination_city || f.destination_address || "Destino"}</div>
              <div className="text-sm font-semibold">{anttDistance > 0 ? `${anttDistance.toLocaleString("pt-BR")} km` : "Aguardando rota"}</div>
            </div>
            <VehicleCatalog configurations={comparisonConfigurations} calculations={floors.data ?? {}}
              selected={selectedVehicle} loading={vehicleCatalog.isLoading || floors.isFetching}
              error={vehicleCatalog.isError || floors.isError} distance={anttDistance}
              bodyTypes={bodyTypes} bodyType={f.req_body_type} onSelect={selectVehicle}
              onBodySelect={(body) => set("req_body_type", body)} />

            <Grid>
              <T label="Valor negociado com cliente (R$)" required={!mode.enabled} type="number" value={f.price} onChange={(v) => set("price", v)} />
              <T label="Valor do motorista (R$)" type="number" value={f.driver_price} onChange={(v) => set("driver_price", v)} />
              <T label="Pedágio (R$)" type="number" value={f.toll} onChange={(v) => set("toll", v)} />
              <T label="Combustível (R$)" type="number" value={f.fuel} onChange={(v) => set("fuel", v)} />
              <T label="Escolta (R$)" type="number" value={f.escort} onChange={(v) => set("escort", v)} />
              <T label="Licença (R$)" type="number" value={f.license} onChange={(v) => set("license", v)} />
              <T label="Outros custos (R$)" type="number" value={f.other_costs} onChange={(v) => set("other_costs", v)} />
              <T label="Margem desejada (R$)" type="number" value={f.margin_amount} onChange={(v) => set("margin_amount", v)} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Prioridade</span>
                <select value={f.priority} onChange={(e) => set("priority", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
            </Grid>
            {routeInfo && (
              <div className="mt-6 mb-6 p-6 rounded-2xl bg-brand/5 border border-brand/10">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand mb-4">Resumo da Rota</div>
                <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-4">
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Distância</div>
                    <div className="text-xl font-bold">{routeInfo.distance_km} km</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Tempo</div>
                    <div className="text-xl font-bold">{Math.floor(routeInfo.duration_minutes / 60)}h {routeInfo.duration_minutes % 60}m</div>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Trajeto</div>
                    <div className="text-sm font-medium mt-1 truncate">
                      {f.origin_city} ({f.origin_state}) → {f.destination_city} ({f.destination_state})
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <KPI label="Custo total informado" value={f.driver_price || f.toll || f.fuel || f.escort || f.license || f.other_costs ? brl(totalCost) : "Pendente"} />
              <KPI label="Lucro previsto" value={f.price ? brl(profit) : "Pendente"} tone={profit >= 0 ? "positive" : "negative"} />
              <KPI label="Margem" value={f.price ? `${margin.toFixed(1)}%` : "Pendente"} tone={margin >= 15 ? "positive" : margin >= 0 ? "neutral" : "negative"} />
            </div>

            <div className="mt-8">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Sugestão de valor ANTT</div>
              <Grid>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo de operação</span>
                  <select value={f.antt_operation_type} onChange={(e) => set("antt_operation_type", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                    {ANTT_OPERATION_TYPES.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Classe da carga</span>
                  <select value={f.antt_cargo_class} onChange={(e) => set("antt_cargo_class", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                    {ANTT_CARGO_CLASSES.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo de contratação</span>
                  <select value={f.antt_contract_type} onChange={(e) => set("antt_contract_type", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                    {ANTT_CONTRACT_TYPES.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Eixos (para o piso)</span>
                  <select value={f.req_axles} onChange={(e) => set("req_axles", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                    <option value="">Selecione</option>
                    {ANTT_AXLE_OPTIONS.map((n) => <option key={n} value={String(n)}>{n} eixos</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Alto desempenho</span>
                  <select value={f.antt_high_performance} onChange={(e) => set("antt_high_performance", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </label>
              </Grid>
              <div className="mt-4">
                {selectedVehicle && (
                  <div className="mb-4 rounded-2xl border border-brand/20 bg-brand/5 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
                      Resumo do frete
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <SummaryItem label="Veículo selecionado" value={selectedVehicle.label} />
                      <SummaryItem
                        label="Distância total"
                        value={anttDistance > 0 ? `${anttDistance.toFixed(1)} km` : "Aguardando rota"}
                      />
                      <SummaryItem
                        label="Piso mínimo ANTT"
                        value={antt?.minimum_freight != null ? brl(antt.minimum_freight) : "Não aplicável"}
                      />
                      <SummaryItem label="Valor negociado" value={brl(clientFreightValue)} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Pedágios, custos adicionais e margem aparecem separados abaixo. Eles não são
                      apresentados como parte do piso oficial da ANTT.
                    </p>
                  </div>
                )}

                {selectedVehicle && <AnttCard
                  calc={antt}
                  loading={anttLoading}
                  negotiated={clientFreightValue}
                  tolls={tolls}
                  extraCosts={extraCosts}
                  margin={marginAmount}
                  onUseSuggested={(value) => {
                    if (f.price.trim()) {
                      const confirmed = window.confirm(
                        "Já existe um valor informado. Deseja substituir pelo valor sugerido?",
                      );
                      if (!confirmed) return;
                    }
                    set("price", value.toFixed(2));
                    toast.success("Valor sugerido aplicado ao frete. Você ainda pode ajustá-lo.");
                  }}
                />}
              </div>
            </div>
          </>
        )}

        {step === 6 && (
          <div>
            <p className="text-sm text-muted-foreground">Anexe NF, CT-e, MDF-e, XML, fotos, PDF ou vídeos. Os arquivos ficam vinculados ao frete.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 px-6 py-10 hover:bg-accent">
              <Upload className="h-5 w-5 text-brand" />
              <span className="text-sm font-medium">Selecionar arquivos</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...list.map((file) => ({ file, kind: guessKind(file.name) }))]);
                  e.target.value = "";
                }}
              />
            </label>
            <ul className="mt-4 divide-y divide-border">
              {files.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.file.name}</div>
                    <div className="text-xs text-muted-foreground">{(it.file.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <select
                    value={it.kind}
                    onChange={(e) => setFiles((prev) => prev.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
                  >
                    <option value="nota_fiscal">NF</option>
                    <option value="cte">CT-e</option>
                    <option value="mdfe">MDF-e</option>
                    <option value="xml">XML</option>
                    <option value="foto">Foto</option>
                    <option value="pdf">PDF</option>
                    <option value="video">Vídeo</option>
                    <option value="outro">Outro</option>
                  </select>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {files.length === 0 && <li className="py-4 text-sm text-muted-foreground">Nenhum arquivo selecionado (opcional).</li>}
            </ul>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise as informações antes de publicar. Ao publicar, o frete fica com status
              <strong className="text-foreground"> Aguardando Motorista</strong> e a oferta é enviada aos motoristas elegíveis.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewBlock title="Cliente" onEdit={() => setStep(0)} rows={[
                ["Cliente", f.client_name],
                ["Contato", f.contact_name],
                ["Telefone", f.contact_phone],
              ]} />
              <ReviewBlock title="Coleta" onEdit={() => setStep(1)} rows={[
                ["Endereço", fullAddress(addressValue("origin"))],
                ["Cidade/UF", `${f.origin_city} ${f.origin_state}`],
                ["Data", `${f.pickup_date} ${f.pickup_time}`],
              ]} />
              <ReviewBlock title="Entrega" onEdit={() => setStep(2)} rows={[
                ["Endereço", fullAddress(addressValue("destination"))],
                ["Cidade/UF", `${f.destination_city} ${f.destination_state}`],
                ["Data", `${f.delivery_date} ${f.delivery_time}`],
              ]} />
              <ReviewBlock title="Carga" onEdit={() => setStep(3)} rows={[
                ["Produto", f.cargo_product || f.cargo_description],
                ["Peso", f.cargo_weight_kg ? `${f.cargo_weight_kg} kg` : ""],
                ["Volumes", f.volumes],
              ]} />
              <ReviewBlock title="Veículo" onEdit={() => setStep(4)} rows={[
                ["Tipo", f.req_vehicle_type || "Indiferente"],
                ["Carroceria", f.req_body_type || "Indiferente"],
                ["Rastreamento", f.tracking_required === "sim" ? "Sim" : "Não"],
              ]} />
              <ReviewBlock title="Valores" onEdit={() => setStep(5)} rows={[
                ["Piso mínimo ANTT", antt?.minimum_freight != null ? brl(antt.minimum_freight) : "Não calculado"],
                ["Pedágios", f.toll ? brl(tolls) : "Não informado"],
                ["Valor sugerido", suggestedValue > 0 ? brl(suggestedValue) : "Não calculado"],
                ["Valor negociado", f.price ? brl(Number(num(f.price))) : "Pendente"],
                ["Situação ANTT", antt?.applicable && antt.minimum_freight != null
                  ? (clientFreightValue >= antt.minimum_freight ? "Acima ou dentro do piso ANTT" : "Abaixo do piso ANTT")
                  : "Não aplicável"],
              ]} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={prev} disabled={step === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={next}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
            Avançar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => void save(false)} disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-60">
              Salvar rascunho
            </button>
            <button onClick={() => void save(true)} disabled={saving || belowFloor}
              title={belowFloor ? "Valor abaixo do piso mínimo ANTT" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
              <Check className="h-4 w-4" /> {saving ? "Publicando…" : mode.enabled ? "Salvar e continuar" : "Publicar frete"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function guessKind(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["xml"].includes(ext)) return "xml";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) return "foto";
  if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
  return "outro";
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function T({
  label, value, onChange, required, type = "text", full,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function KPI({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const cls =
    tone === "positive" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "negative" ? "bg-red-50 text-red-700 border-red-200"
    : "bg-surface-2 text-foreground border-border";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ReviewBlock({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: Array<[string, string | number | null | undefined]>;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
        <button onClick={onEdit} className="text-xs font-semibold text-brand hover:underline">
          Editar
        </button>
      </div>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right font-medium">{v ? String(v) : "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
