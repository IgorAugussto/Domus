import { currentDomusUserId, requireData } from "../lib/financial";
import { supabase } from "../lib/supabase";

export interface CreditCard { id:number; brand:string; lastFourDigits:string; nickname?:string; active:boolean; statementClosingDay?:number; dueDay?:number; }
export interface CreditCardCreateInput { brand:string; lastFourDigits:string; nickname?:string; statementClosingDay?:number; dueDay?:number; }
type Row={id:number;brand:string;last_four_digits:string;nickname:string|null;active:boolean;statement_closing_day:number|null;due_day:number|null};
const map=(r:Row):CreditCard=>({id:r.id,brand:r.brand,lastFourDigits:r.last_four_digits,nickname:r.nickname??undefined,active:r.active,statementClosingDay:r.statement_closing_day??undefined,dueDay:r.due_day??undefined});
export const creditCardService={
  getAll:async():Promise<CreditCard[]>=>{const{data,error}=await supabase.from("credit_cards").select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day").eq("active",true).order("created_at",{ascending:false});if(error)throw error;return(data as Row[]).map(map);},
  create:async(data:CreditCardCreateInput):Promise<CreditCard>=>{if(!/^\d{4}$/.test(data.lastFourDigits))throw new Error("Informe exatamente 4 dígitos numéricos.");for(const [label,day] of [["Fechamento",data.statementClosingDay],["Vencimento",data.dueDay]] as const)if(day!=null&&(!Number.isInteger(day)||day<1||day>31))throw new Error(`${label} deve estar entre 1 e 31.`);const userId=await currentDomusUserId();const{data:row,error}=await supabase.from("credit_cards").insert({user_id:userId,brand:data.brand,last_four_digits:data.lastFourDigits,nickname:data.nickname||null,statement_closing_day:data.statementClosingDay??null,due_day:data.dueDay??null,active:true}).select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day").single();return map(requireData(row as Row|null,error));},
  deactivate:async(id:number):Promise<void>=>{const{error}=await supabase.from("credit_cards").update({active:false}).eq("id",id);if(error)throw error;},
};
