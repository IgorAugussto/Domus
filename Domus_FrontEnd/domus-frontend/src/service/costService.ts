import { currentDomusUserId, requireData, withoutUndefined } from "../lib/financial";
import { supabase } from "../lib/supabase";
export type PaymentType="Cartão de Crédito"|"Boleto"|"Pix"|"Débito";
export type ExpenseOrigin="manual"|"notification"|"statement_import";
export interface Cost{id:number;description:string;value:number;startDate:string;category:string;frequency:string;durationInMonths:number;paymentType:PaymentType;paid:boolean;creditCardId?:number;origin:ExpenseOrigin;reviewed:boolean;purchaseAt?:string; installmentTotal?: number; plannedAccountId?: number; }
export interface CostCreateInput{amount:number;description:string;startDate:string;category:string;frequency:string;durationInMonths:number;paymentType:PaymentType;paid?:boolean;creditCardId?:number; installmentTotal?: number | null; plannedAccountId?: number | null; }
export interface CostUpdateInput extends Partial<CostCreateInput>{value?:number;}
type Row={id:number;description:string;value:number|string;start_date:string;category:string|null;frequency:string;duration_in_months:number;payment_type:PaymentType;paid:boolean;credit_card_id:number|null;origin:ExpenseOrigin|null;reviewed:boolean|null;purchase_at:string|null; installment_total:number|string|null; planned_account_id:number|null};
const map=(r:Row):Cost=>({id:r.id,description:r.description,value:Number(r.value),startDate:r.start_date,category:r.category??"",frequency:r.frequency,durationInMonths:r.duration_in_months,paymentType:r.payment_type,paid:r.paid,creditCardId:r.credit_card_id??undefined,origin:r.origin??"manual",reviewed:r.reviewed??true,purchaseAt:r.purchase_at??undefined,installmentTotal:r.installment_total == null ? undefined : Number(r.installment_total),plannedAccountId:r.planned_account_id??undefined});
export const costService={
  createImmediate: async (d: { description: string; amount: number; date: string; category: string; paymentType: "Pix" | "Débito"; accountId: number; requestKey: string }): Promise<void> => {
    const { error } = await supabase.rpc("domus_create_immediate_expense", { p_description: d.description, p_amount: d.amount, p_date: d.date, p_category: d.category, p_payment_type: d.paymentType, p_account_id: d.accountId, p_request_key: d.requestKey });
    if (error) throw error;
  },
 create:async(d:CostCreateInput)=>{const userId=await currentDomusUserId();const{data,error}=await supabase.from("outgoing").insert({user_id:userId,value:d.amount,description:d.description,start_date:d.startDate,category:d.category,frequency:d.frequency,duration_in_months:d.frequency==="One-time"?1:d.durationInMonths,payment_type:d.paymentType,paid:d.paid??false,credit_card_id:d.creditCardId??null,installment_total:d.installmentTotal??null,planned_account_id:d.plannedAccountId??null}).select().single();return map(requireData(data as Row|null,error));},
 getAll:async():Promise<Cost[]>=>{const{data,error}=await supabase.from("outgoing").select("id,description,value,start_date,category,frequency,duration_in_months,payment_type,paid,credit_card_id,origin,reviewed,purchase_at,installment_total,planned_account_id").order("start_date",{ascending:false});if(error)throw error;return(data as Row[]).map(map);},
 getTotal:async()=> (await costService.getAll()).reduce((s,i)=>s+i.value,0),
 update:async(id:number,d:CostUpdateInput)=>{const p=withoutUndefined({value:d.amount??d.value,description:d.description,start_date:d.startDate,category:d.category,frequency:d.frequency,duration_in_months:d.frequency==="One-time"?1:d.durationInMonths,payment_type:d.paymentType,paid:d.paid,credit_card_id:d.creditCardId,installment_total:d.installmentTotal,planned_account_id:d.plannedAccountId});const{data,error}=await supabase.from("outgoing").update(p).eq("id",id).select().single();return map(requireData(data as Row|null,error));},
 delete:async(id:number)=>{const{error}=await supabase.from("outgoing").delete().eq("id",id);if(error)throw error;},
};
