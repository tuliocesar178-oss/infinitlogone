import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search } from "lucide-react";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;

export type MapboxLocation = {
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
  number: string;
  lat: number;
  lng: number;
  full_name: string;
};

export function MapboxAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Digite o endereço...",
  label,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (loc: MapboxLocation) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = async (q: string) => {
    if (!q || q.length < 3 || !TOKEN) return;
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&country=BR&language=pt&limit=5&types=address,poi`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
      setOpen(true);
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    onChange(val);
    const timeoutId = setTimeout(() => search(val), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSelect = (feat: any) => {
    const ctx = feat.context || [];
    const getPart = (type: string) => ctx.find((c: any) => c.id.startsWith(type))?.text || "";
    
    const loc: MapboxLocation = {
      address: feat.text || "",
      city: getPart("place"),
      state: getPart("region"),
      zip: getPart("postcode"),
      neighborhood: getPart("neighborhood") || getPart("locality"),
      number: feat.address || "",
      lat: feat.center[1],
      lng: feat.center[0],
      full_name: feat.place_name,
    };

    setQuery(loc.full_name);
    setOpen(false);
    onSelect(loc);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-surface px-10 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          onFocus={() => query.length >= 3 && setOpen(true)}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background p-1 shadow-xl">
          {suggestions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium truncate">{s.text}</div>
                <div className="text-xs text-muted-foreground truncate">{s.place_name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
