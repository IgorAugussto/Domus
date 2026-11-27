import { supabase } from "../lib/supabase";
export interface PaymentMonthItem { outgoingId:number; description:string; value:number; category:string; paymentType:string; frequency:string; startDate:string; yearMonth:string; paid:boolean; creditCardId?:number; legacyMarked:boolean; cashPaid:number; hasCashMovements:boolean; }
type Row={outgoing_id:number;description:string;value:number|string;category:string|null;payment_type:string;frequency:string;start_date:string;year_month:string;paid:boolean;credit_card_id:number|null};
type CashRow={outgoing_id:number;paid_total:number|string;has_cash_movements:boolean};
const map=(r:Row):PaymentMonthItem=>({outgoingId:r.outgoing_id,description:r.description,value:Number(r.value),category:r.category??"",paymentType:r.payment_type,frequency:r.frequency,startDate:r.start_date,yearMonth:r.year_month,paid:r.paid,legacyMarked:r.paid,cashPaid:0,hasCashMovements:false,creditCardId:r.credit_card_id??undefined});
export const paymentStatusService={
  getByMonth:async(yearMonth:string):Promise<PaymentMonthItem[]>=>{
    const [legacy,cash]=await Promise.all([supabase.rpc("domus_monthly_payments",{p_year_month:yearMonth}),supabase.rpc("domus_cash_expense_totals",{p_source_month:`${yearMonth}-01`})]);
    if(legacy.error)throw legacy.error;if(cash.error)throw cash.error;
    const totals=new Map(((cash.data??[]) as CashRow[]).map(row=>[row.outgoing_id,row]));
    return ((legacy.data??[]) as Row[]).map(row=>{const item=map(row);const total=totals.get(item.outgoingId);if(!total)return item;const paid=Number(total.paid_total);return {...item,cashPaid:paid,hasCashMovements:true,paid:Math.round(paid*100)>=Math.round(item.value*100)};});
  },
  toggle:async(outgoingId:number,yearMonth:string,paid:boolean):Promise<PaymentMonthItem>=>{const{data,error}=await supabase.rpc("domus_set_payment_status",{p_outgoing_id:outgoingId,p_year_month:yearMonth,p_paid:paid});if(error)throw error;const row=(data as Row[])[0];if(!row)throw new Error("Pagamento não encontrado.");return map(row);},
};
