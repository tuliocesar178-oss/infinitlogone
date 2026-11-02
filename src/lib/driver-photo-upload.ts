import { supabase } from "@/integrations/supabase/client";
import { driverPhotoPath, type DriverPhotoSelection } from "@/lib/driver-photo-categories";
export async function uploadDriverPhotos(items: DriverPhotoSelection[], orderId: string, userId: string, stage: "pickup" | "delivery", position: [number, number] | null) {
  const uploads = [];
  for (const item of items) {
    const path = driverPhotoPath(orderId, item.id, item.file.name);
    const existing = await supabase.from("order_attachments").select("id,file_path").eq("id", item.id).eq("order_id", orderId).eq("uploaded_by", userId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      uploads.push({ path: existing.data.file_path, kind: item.kind, name: item.file.name, type: item.file.type, size: item.file.size });
      continue;
    }
    const up = await supabase.storage.from("order-files").upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (up.error) throw up.error;
    const attachment = await supabase.from("order_attachments").insert({ id: item.id, order_id: orderId, kind: item.kind, label: `${item.label} · ${item.file.name}`, file_path: path, mime_type: item.file.type, size_bytes: item.file.size, uploaded_by: userId, event_status: stage === "pickup" ? "loaded" : "delivered", latitude: position?.[1] ?? null, longitude: position?.[0] ?? null, metadata: { source: `driver_${stage}_checklist`, photo_category: item.category } });
    if (attachment.error) { await supabase.storage.from("order-files").remove([path]); throw attachment.error; }
    uploads.push({ path, kind: item.kind, name: item.file.name, type: item.file.type, size: item.file.size });
  }
  return uploads;
}