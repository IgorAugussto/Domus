import { currentDomusUserId, requireData, withoutUndefined } from "../lib/financial";
import { supabase } from "../lib/supabase";
export interface Income { id?:string; description:string; value:number; startDate:string; endDate:string; frequency:string; recurring:boolean; category:string; }
export interface IncomeCreateInput { amount:number; description:string; startDate:string; endDate:string; recurring:boolean; category:string; frequency:string; }
export interface IncomeUpdateInput { amount?:number; description?:string; startDate?:string; endDate?:string; recurring?:boolean; category?:string; frequency?:string; }
type Row={id:number;description:string;value:number|string;start_date:string;end_date:string|null;frequency:string;recurring:boolean|null;category:string|null};
const map=(r:Row):Income=>({id:String(r.id),description:r.description,value:Number(r.value),startDate:r.start_date,endDate:r.end_date??"",frequency:r.frequency,recurring:Boolean(r.recurring),category:r.category??""});
export const incomeService={
 create:async(d:IncomeCreateInput)=>{const userId=await currentDomusUserId();const end=d.frequency==="Monthly"?addYear(d.startDate):d.endDate||null;const{data,error}=await supabase.from("income").insert({user_id:userId,value:d.amount,description:d.description,start_date:d.startDate,end_date:end,recurring:d.frequency==="Monthly",category:d.category,frequency:d.frequency}).select().single();return map(requireData(data as Row|null,error));},
 getAll:async():Promise<Income[]>=>{const{data,error}=await supabase.from("income").select("id,description,value,start_date,end_date,frequency,recurring,category").order("start_date",{ascending:true});if(error)throw error;return(data as Row[]).map(map);},
 getTotal:async()=> (await incomeService.getAll()).reduce((s,i)=>s+i.value,0),
 update:async(id:number,d:IncomeUpdateInput)=>{const p=withoutUndefined({value:d.amount,description:d.description,start_date:d.startDate,end_date:d.frequency==="Monthly"&&d.startDate?addYear(d.startDate):d.endDate,recurring:d.frequency===undefined?d.recurring:d.frequency==="Monthly",category:d.category,frequency:d.frequency});const{data,error}=await supabase.from("income").update(p).eq("id",id).select().single();return map(requireData(data as Row|null,error));},
 delete:async(id:number)=>{const{error}=await supabase.from("income").delete().eq("id",id);if(error)throw error;},
};
function addYear(date:string){const d=new Date(`${date}T00:00:00`);d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10);}
