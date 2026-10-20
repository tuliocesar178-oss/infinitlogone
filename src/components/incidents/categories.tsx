import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveCategories } from '@/lib/incidents/functions';
import { PRIORITIES, type IncidentCategory } from '@/lib/incidents/model';

export function IncidentCategories({ categories }: { categories: IncidentCategory[] }) {
  const [items, setItems] = useState(categories), qc = useQueryClient(), save = useServerFn(saveCategories);
  const mutation = useMutation({ mutationFn: () => save({ data: items }), onSuccess: () => qc.invalidateQueries({ queryKey: ['incident-workspace'] }) });
  const patch = (index: number, value: Partial<IncidentCategory>) => setItems(previous => previous.map((c, k) => k === index ? { ...c, ...value } : c));
  return <div className="space-y-3">{items.map((c, index) => <div key={index} className="grid gap-2 border-b pb-3 sm:grid-cols-2"><Input aria-label={`Identificador ${index + 1}`} value={c.value} disabled={c.value === 'other'} onChange={e => patch(index, { value: e.target.value })} /><Input aria-label={`Nome da categoria ${index + 1}`} value={c.label} onChange={e => patch(index, { label: e.target.value })} /><select aria-label={`Prioridade padrão ${index + 1}`} className="h-10 rounded-md border bg-background px-2" value={c.priority} onChange={e => patch(index, { priority: e.target.value as keyof typeof PRIORITIES })}>{Object.entries(PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.requires_description} disabled={c.value === 'other'} onChange={e => patch(index, { requires_description: e.target.checked })} />Descrição obrigatória</label><Button size="icon" variant="ghost" disabled={c.value === 'other'} aria-label={`Remover categoria ${c.label}`} onClick={() => setItems(previous => previous.filter((_, k) => k !== index))}><Trash2 /></Button></div></div>)}<div className="flex gap-2"><Button variant="outline" disabled={items.length >= 40} onClick={() => setItems(previous => [...previous, { value: `category_${String.fromCharCode(97 + previous.length % 26)}`, label: '', priority: 'attention', requires_description: true }])}><Plus />Categoria</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}><Save />Salvar categorias</Button></div>{mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}{mutation.isSuccess && <p role="status" className="text-success">Categorias salvas.</p>}</div>;
}