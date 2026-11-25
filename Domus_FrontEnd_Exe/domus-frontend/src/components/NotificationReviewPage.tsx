import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "../ui-components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui-components/card";
import { FeedbackToast } from "./FeedbackToast";
import { notificationReviewService, type NotificationReviewItem } from "../service/notificationReviewService";

const sourceLabel: Record<string, string> = { google_wallet: "Carteira do Google", nubank: "Nubank", whatsapp: "WhatsApp (teste)", manual_test: "Simulador Domus" };
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Horário não informado";

export function NotificationReviewPage() {
  const [items, setItems] = useState<NotificationReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems(await notificationReviewService.getPending()); } catch { setToast({ message: "Não foi possível carregar os lançamentos capturados.", type: "error" }); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const markReviewed = async (id: number) => { setReviewingId(id); try { await notificationReviewService.markReviewed(id); setItems((current) => current.filter((item) => item.id !== id)); setToast({ message: "Lançamento confirmado.", type: "success" }); } catch { setToast({ message: "Não foi possível confirmar o lançamento.", type: "error" }); } finally { setReviewingId(null); } };
  return <div className="space-y-6 px-1">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: "var(--financial-trust)" }}><BellRing className="h-5 w-5" /> Revisar capturas</h2><p className="mt-0.5 text-sm" style={{ color: "var(--muted-foreground)" }}>Confirme os lançamentos vindos das notificações antes de considerá-los revisados.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /> Atualizar</Button></div>
    {loading ? <Card><CardContent className="pt-6 text-sm text-muted-foreground">Carregando capturas...</CardContent></Card> : items.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><p className="font-medium">Nenhum lançamento pendente de revisão.</p><p className="text-sm text-muted-foreground">As notificações sincronizadas pelo Android aparecerão aqui.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <Card key={item.id} className="border-amber-200 dark:border-amber-900"><CardHeader className="gap-2"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{item.description}</CardTitle><span className="whitespace-nowrap font-bold text-red-600">{currency(item.value)}</span></div><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{dateTime(item.purchaseAt ?? item.createdAt)}</span><span>·</span><span>{item.category}</span>{item.simulated && <><span>·</span><span className="font-semibold text-amber-700">SIMULADA</span></>}</div></CardHeader><CardContent className="space-y-4"><div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Fonte{item.sources.length === 1 ? "" : "s"}: {item.sources.map((source) => sourceLabel[source] ?? source).join(", ") || "não identificada"}{item.eventCount > 1 && ` · ${item.eventCount} notificações corroboraram esta compra`}</div><Button className="w-full" onClick={() => markReviewed(item.id)} disabled={reviewingId === item.id}><CheckCircle2 /> {reviewingId === item.id ? "Confirmando..." : "Confirmar lançamento"}</Button></CardContent></Card>)}</div>}
    {toast && <FeedbackToast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
