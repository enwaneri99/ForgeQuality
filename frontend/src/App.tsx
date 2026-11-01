import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Boxes, BriefcaseBusiness,
  CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Download, Factory, FileBarChart2, Gauge,
  HardHat, ImagePlus, LayoutDashboard, LogOut, Plus, Search, Settings2, ShieldCheck, Trash2, UploadCloud, Wrench, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import "./asset.css";

const API = import.meta.env.VITE_API_URL ?? "";
type Entity = "production" | "defects" | "inspections" | "equipment" | "issues" | "downtime" | "maintenance";
type Field = { key: string; label: string; type?: string; required?: boolean; options?: string[]; min?: number };
type Config = { label: string; singular: string; icon: typeof Boxes; fields: Field[]; columns: string[] };
type DefectPhoto = {id:number;file_name:string;media_type:string;file_size:number;uploaded_at:string;previewUrl:string;originalUrl:string};
const configs: Record<Entity, Config> = {
  production: { label: "Production", singular: "Production record", icon: Boxes, fields: [
    {key:"order_number",label:"Work order",required:true},{key:"product",label:"Product",required:true},
    {key:"batch",label:"Lot / batch",required:true},{key:"line",label:"Production line",required:true},
    {key:"workstation",label:"Workstation"},{key:"equipment_id",label:"Equipment ID"},{key:"shift",label:"Shift",options:["Day","Swing","Night"]},
    {key:"operator",label:"Operator"},{key:"supervisor",label:"Supervisor"},{key:"target_quantity",label:"Target units",type:"number",min:0},
    {key:"actual_quantity",label:"Units produced",type:"number",min:0},{key:"good_quantity",label:"Good units",type:"number",min:0},
    {key:"defective_quantity",label:"Defective units",type:"number",min:0},{key:"rework_quantity",label:"Rework units",type:"number",min:0},
    {key:"scrap_quantity",label:"Scrap units",type:"number",min:0},{key:"rejected_quantity",label:"Rejected units",type:"number",min:0},
    {key:"awaiting_inspection",label:"Awaiting inspection",type:"number",min:0},{key:"started_at",label:"Production start",type:"datetime-local"},
    {key:"ended_at",label:"Production end",type:"datetime-local"},
    {key:"status",label:"Status",options:["In progress","Completed","On hold"]},
  ], columns:["order_number","product","batch","line","actual_quantity","good_quantity","status"] },
  defects: { label: "Nonconformance", singular: "Defect report", icon: AlertTriangle, fields: [
    {key:"product",label:"Product",required:true},{key:"component",label:"Component / part"},{key:"supplier",label:"Supplier"},
    {key:"batch",label:"Lot / batch",required:true},{key:"line",label:"Production line"},{key:"workstation",label:"Workstation"},{key:"equipment_id",label:"Equipment ID"},
    {key:"category",label:"Defect category",required:true,options:["Dimensional","Surface finish","Material","Assembly","Electrical","Packaging","Other"]},
    {key:"description",label:"Defect description",type:"textarea",required:true},{key:"severity",label:"Severity",options:["Medium","Low","High","Critical"]},{key:"priority",label:"Priority",options:["Medium","Low","High","Critical"]},
    {key:"quantity_inspected",label:"Quantity inspected",type:"number",min:0},{key:"quantity_defective",label:"Quantity defective",type:"number",min:1},
    {key:"source",label:"Detection source",options:["Operator inspection","Quality inspection","Automated inspection","Customer"]},
    {key:"reported_by",label:"Reported by"},{key:"assigned_to",label:"Investigator"},{key:"due_date",label:"Investigation due date",type:"date"},
    {key:"containment",label:"Containment action",type:"textarea"},{key:"root_cause",label:"Suspected root cause",type:"textarea"},
    {key:"corrective_action",label:"Corrective / preventive action",type:"textarea"},
    {key:"status",label:"Investigation status",options:["Open","Under investigation","Contained","Corrective action","Closed"]},
  ], columns:["defect_number","product","batch","category","severity","quantity_defective","status"] },
  inspections: { label: "Inspections", singular: "Inspection", icon: ClipboardCheck, fields: [
    {key:"inspection_type",label:"Inspection type",required:true,options:["Incoming","In-process","Final"]},
    {key:"product",label:"Product / component",required:true},{key:"batch",label:"Lot / batch",required:true},
    {key:"characteristic",label:"Characteristic",required:true},{key:"measured_value",label:"Measured value",type:"number",required:true},
    {key:"lower_limit",label:"Lower specification limit",type:"number",required:true},{key:"upper_limit",label:"Upper specification limit",type:"number",required:true},
    {key:"inspector",label:"Inspector"},{key:"notes",label:"Notes",type:"textarea"},
  ], columns:["inspection_type","product","batch","characteristic","measured_value","result","inspector"] },
  equipment: { label: "Equipment", singular: "Equipment asset", icon: Settings2, fields: [
    {key:"equipment_code",label:"Asset ID",required:true},{key:"name",label:"Equipment name",required:true},
    {key:"equipment_type",label:"Asset type",options:["Machine","Tool","Inspection equipment","Conveyor","Other"]},
    {key:"manufacturer",label:"Manufacturer"},{key:"model",label:"Model"},{key:"serial_number",label:"Serial number"},
    {key:"line",label:"Production line"},{key:"location",label:"Location"},
    {key:"status",label:"Operating status",options:["Operational","Restricted","Down","Maintenance"]},
    {key:"criticality",label:"Criticality",options:["Medium","Low","High","Critical"]},
    {key:"assigned_technician",label:"Maintenance owner"},{key:"maintenance_due",label:"Next maintenance due",type:"date"},
  ], columns:["equipment_code","name","line","location","status","criticality","assigned_technician"] },
  issues: { label: "Equipment issues", singular: "Equipment issue", icon: Wrench, fields: [
    {key:"equipment_id",label:"Equipment record ID",type:"number",required:true},{key:"problem",label:"Problem & symptoms",type:"textarea",required:true},
    {key:"severity",label:"Severity",options:["Medium","Low","High","Critical"]},
    {key:"machine_state",label:"Machine condition",options:["Running","Running with restrictions","Stopped"]},
    {key:"safety_concern",label:"Safety concern",type:"checkbox"},{key:"reported_by",label:"Reported by"},
    {key:"assigned_to",label:"Assigned technician"},{key:"resolution",label:"Repair / resolution notes",type:"textarea"},
    {key:"parts_used",label:"Parts used",type:"textarea"},{key:"root_cause",label:"Root cause",type:"textarea"},
    {key:"follow_up",label:"Follow-up actions",type:"textarea"},
  ], columns:["equipment_id","problem","severity","machine_state","status","reported_by"] },
  downtime: { label: "Downtime", singular: "Downtime event", icon: Clock3, fields: [
    {key:"equipment_id",label:"Equipment record ID",type:"number",required:true},{key:"issue_id",label:"Related issue ID",type:"number"},
    {key:"line",label:"Production line"},{key:"reason",label:"Reason category",required:true,options:["Breakdown","Changeover","Planned maintenance","Material shortage","Quality hold","Other"]},
    {key:"explanation",label:"Details",type:"textarea"},{key:"planned",label:"Planned downtime",type:"checkbox"},
    {key:"production_loss",label:"Estimated production loss (units)",type:"number",min:0},
  ], columns:["equipment_id","line","reason","planned","production_loss","started_at","ended_at"] },
  maintenance: { label: "Maintenance", singular: "Work order", icon: Wrench, fields: [
    {key:"equipment_id",label:"Equipment record ID",type:"number",required:true},{key:"title",label:"Work order title",required:true},
    {key:"work_type",label:"Work type",options:["Preventive","Corrective","Inspection"]},{key:"priority",label:"Priority",options:["Medium","Low","High","Critical"]},
    {key:"assigned_to",label:"Assigned technician"},{key:"status",label:"Status",options:["Open","In progress","On hold","Completed"]},
    {key:"due_date",label:"Due date",type:"date"},{key:"notes",label:"Work notes",type:"textarea"},
  ], columns:["equipment_id","title","work_type","priority","assigned_to","status","due_date"] },
};
const navItems: { title: string; entity?: Entity; icon: typeof Gauge; section: string }[] = [
  {title:"Overview",icon:LayoutDashboard,section:"WORKSPACE"},
  {title:"Production",entity:"production",icon:Boxes,section:"OPERATIONS"},
  {title:"Quality inspections",entity:"inspections",icon:ClipboardCheck,section:"OPERATIONS"},
  {title:"Nonconformance",entity:"defects",icon:AlertTriangle,section:"OPERATIONS"},
  {title:"Equipment",entity:"equipment",icon:Settings2,section:"ASSET CARE"},
  {title:"Equipment issues",entity:"issues",icon:Wrench,section:"ASSET CARE"},
  {title:"Downtime",entity:"downtime",icon:Clock3,section:"ASSET CARE"},
  {title:"Maintenance",entity:"maintenance",icon:HardHat,section:"ASSET CARE"},
  {title:"Reports",icon:FileBarChart2,section:"INSIGHTS"},
];
type Dashboard = {total_production:number;good_units:number;defective_units:number;awaiting_inspection:number;yield_percent:number;defect_rate:number;inspection_pass_rate:number;equipment_operational:number;equipment_total:number;open_issues:number;maintenance_backlog:number;downtime_hours:number;unplanned_downtime_hours:number;mttr_hours:number|null;mttr_completed_repairs:number;recent_defects:Record<string,unknown>[];production_by_line:{line:string;produced:number;target:number;defects:number}[]};
const emptyDashboard: Dashboard = {total_production:0,good_units:0,defective_units:0,awaiting_inspection:0,yield_percent:0,defect_rate:0,inspection_pass_rate:0,equipment_operational:0,equipment_total:0,open_issues:0,maintenance_backlog:0,downtime_hours:0,unplanned_downtime_hours:0,mttr_hours:null,mttr_completed_repairs:0,recent_defects:[],production_by_line:[]};
const maxPhotoBytes=10*1024*1024;
const maxDefectPhotos=10;

async function request<T>(path:string, token:string, init?:RequestInit):Promise<T> {
  const response=await fetch(`${API}/api${path}`,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...init?.headers}});
  if(!response.ok){const body=await response.json().catch(()=>({detail:"Request failed"}));throw new Error(body.detail??"Request failed");}
  return response.json() as Promise<T>;
}
function labelize(value:string){return value.replace(/_/g," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function display(value:unknown){if(value===null||value===undefined||value==="")return "—";if(typeof value==="boolean")return value?"Yes":"No";if(typeof value==="string"&&value.includes("T"))return new Date(value).toLocaleString();return String(value);}
function badgeTone(value:unknown){const s=String(value).toLowerCase();if(["closed","completed","pass","operational"].includes(s))return "green";if(["critical","high","fail","down","open"].includes(s))return "red";if(["in progress","under investigation","restricted","contained"].includes(s))return "amber";return "neutral";}
function canEditRecord(entity:Entity,role:string){const roles:Record<Entity,string[]>={production:["admin","supervisor"],defects:["admin","supervisor","quality_engineer"],inspections:[],equipment:["admin","maintenance"],issues:["admin","supervisor","maintenance"],downtime:["admin","supervisor","maintenance"],maintenance:["admin","supervisor","maintenance"]};return roles[entity].includes(role);}

export default function App(){
  const [token,setToken]=useState(()=>localStorage.getItem("forgequality_token")??"");
  const [username,setUsername]=useState(()=>localStorage.getItem("forgequality_user")??"");
  const [role,setRole]=useState(()=>localStorage.getItem("forgequality_role")??"");
  const [page,setPage]=useState("Overview");
  const [dashboard,setDashboard]=useState(emptyDashboard);
  const [records,setRecords]=useState<Record<string,unknown>[]>([]);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [modal,setModal]=useState(false);
  const [composerEntity,setComposerEntity]=useState<Entity|null>(null);
  const [editingRecordId,setEditingRecordId]=useState<number|null>(null);
  const [pendingPhotoDefectId,setPendingPhotoDefectId]=useState<number|null>(null);
  const [form,setForm]=useState<Record<string,string|boolean>>({});
  const [selectedPhotos,setSelectedPhotos]=useState<File[]>([]);
  const [existingPhotoCount,setExistingPhotoCount]=useState(0);
  const [draggingPhotos,setDraggingPhotos]=useState(false);
  const [defectPhotos,setDefectPhotos]=useState<DefectPhoto[]>([]);
  const [photoGalleryOpen,setPhotoGalleryOpen]=useState(false);
  const [qr,setQr]=useState<{src:string;name:string}|null>(null);
  const [selectedAsset,setSelectedAsset]=useState<Record<string,unknown>|null>(null);
  const [assetHistory,setAssetHistory]=useState<{issues:Record<string,unknown>[];downtime:Record<string,unknown>[];maintenance:Record<string,unknown>[]} | null>(null);
  const active=navItems.find((item)=>item.title===page);
  const entity=active?.entity;

  const loadDashboard=useCallback(async()=>{if(!token)return;try{setDashboard(await request<Dashboard>("/dashboard",token));setError("");}catch(e){setError((e as Error).message);}},[token]);
  const loadRecords=useCallback(async()=>{if(!token||!entity)return;try{setRecords(await request<Record<string,unknown>[]>(`/${entity}?search=${encodeURIComponent(search)}`,token));setError("");}catch(e){setError((e as Error).message);}},[token,entity,search]);
  useEffect(()=>{if(!token)return;if(page==="Overview")void loadDashboard();else if(entity)void loadRecords();},[token,page,entity,loadDashboard,loadRecords]);
  useEffect(()=>{if(!notice)return;const timeout=window.setTimeout(()=>setNotice(""),3500);return()=>window.clearTimeout(timeout);},[notice]);
  useEffect(()=>{const equipmentId=new URLSearchParams(window.location.search).get("equipment");if(!token||!equipmentId)return;let cancelled=false;Promise.all([request<Record<string,unknown>[]>("/equipment",token),request<{issues:Record<string,unknown>[];downtime:Record<string,unknown>[];maintenance:Record<string,unknown>[]}>(`/equipment/${equipmentId}/history`,token)]).then(([assets,history])=>{if(cancelled)return;const asset=assets.find((item)=>String(item.id)===equipmentId);if(!asset)throw new Error("Equipment record not found");setPage("Equipment");setSelectedAsset(asset);setAssetHistory(history);}).catch((e)=>{if(!cancelled)setError((e as Error).message);});return()=>{cancelled=true;};},[token]);

  async function signIn(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const data=new FormData(event.currentTarget);try{const response=await fetch(`${API}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:data.get("username"),password:data.get("password")})});if(!response.ok)throw new Error("Invalid username or password");const result=await response.json();setToken(result.access_token);setUsername(result.username);setRole(result.role);localStorage.setItem("forgequality_token",result.access_token);localStorage.setItem("forgequality_user",result.username);localStorage.setItem("forgequality_role",result.role);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function signOut(){localStorage.removeItem("forgequality_token");localStorage.removeItem("forgequality_user");localStorage.removeItem("forgequality_role");setToken("");setUsername("");setRole("");setPage("Overview");}
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!composerEntity)return;setBusy(true);setError("");const payload:Record<string,unknown>={};for(const field of configs[composerEntity].fields){const value=form[field.key];if(value===undefined||value==="")continue;payload[field.key]=field.type==="number"?Number(value):field.type==="checkbox"?Boolean(value):value;}
    try{
      const retryingPhotoUpload=pendingPhotoDefectId!==null&&composerEntity==="defects";
      const saved=retryingPhotoUpload?{id:pendingPhotoDefectId}:await request<Record<string,unknown>>(`/${composerEntity}${editingRecordId===null?"":`/${editingRecordId}`}`,token,{method:editingRecordId===null?"POST":"PATCH",body:JSON.stringify(payload)});
      const defectId=Number(saved.id);
      if(composerEntity==="defects"&&selectedPhotos.length){
        const upload=new FormData();selectedPhotos.forEach((photo)=>upload.append("files",photo,photo.name));
        const response=await fetch(`${API}/api/defects/${defectId}/images`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:upload});
        if(!response.ok){const body=await response.json().catch(()=>({detail:"Photo upload failed"}));setEditingRecordId(defectId);setPendingPhotoDefectId(defectId);throw new Error(`Defect saved, but photos were not uploaded: ${body.detail??"Upload failed"}. Retry saving to upload the selected photos.`);}
      }
      setModal(false);setForm({});setEditingRecordId(null);setPendingPhotoDefectId(null);setSelectedPhotos([]);setNotice(`${configs[composerEntity].singular} ${editingRecordId===null?"created":"updated"} successfully.`);if(page==="Overview")void loadDashboard();if(composerEntity===entity)void loadRecords();if(selectedAsset&&composerEntity==="issues"){const history=await request<typeof assetHistory>(`/equipment/${selectedAsset.id}/history`,token);setAssetHistory(history);}if(composerEntity==="issues")setSelectedAsset(null);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function updateStatus(id:number,statusValue:string){if(!entity)return;try{await request(`/${entity}/${id}`,token,{method:"PATCH",body:JSON.stringify({status:statusValue})});setNotice("Record status updated.");void loadRecords();}catch(e){setError((e as Error).message);}}
  async function loadQr(record:Record<string,unknown>){try{const response=await fetch(`${API}/api/equipment/${record.id}/qr`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error("Unable to load equipment QR code");setQr({src:URL.createObjectURL(await response.blob()),name:String(record.name??record.equipment_code)});}catch(e){setError((e as Error).message);}}
  async function loadEquipment(record:Record<string,unknown>){try{const history=await request<typeof assetHistory>(`/equipment/${record.id}/history`,token);setSelectedAsset(record);setAssetHistory(history);}catch(e){setError((e as Error).message);}}
  function editRecord(record:Record<string,unknown>){if(!entity)return;setComposerEntity(entity);setEditingRecordId(Number(record.id));setPendingPhotoDefectId(null);setExistingPhotoCount(Number(record.image_count??0));setSelectedPhotos([]);const values:Record<string,string|boolean>={};for(const field of configs[entity].fields){const value=record[field.key];if(value===undefined||value===null)continue;values[field.key]=field.type==="checkbox"?Boolean(value):field.type==="datetime-local"?String(value).slice(0,16):field.type==="date"?String(value).slice(0,10):String(value);}setForm(values);setModal(true);}
  function reportAssetIssue(){if(!selectedAsset)return;setComposerEntity("issues");setForm({equipment_id:String(selectedAsset.id),reported_by:username});setSelectedAsset(null);setModal(true);}
  async function createDefectFromInspection(record:Record<string,unknown>){try{await request(`/inspections/${record.id}/create-defect`,token,{method:"POST"});setNotice("Defect created from failed inspection.");}catch(e){setError((e as Error).message);}}
  async function loadDefectPhotos(record:Record<string,unknown>){
    try{
      const metadata=await request<Omit<DefectPhoto,"previewUrl"|"originalUrl">[]>(`/defects/${record.id}/images`,token);
      const photos=await Promise.all(metadata.map(async(photo)=>{
        const [previewResponse,originalResponse]=await Promise.all([
          fetch(`${API}/api/defect-images/${photo.id}/preview`,{headers:{Authorization:`Bearer ${token}`}}),
          fetch(`${API}/api/defect-images/${photo.id}`,{headers:{Authorization:`Bearer ${token}`}}),
        ]);
        if(!previewResponse.ok||!originalResponse.ok)throw new Error(`Unable to load photo ${photo.file_name}`);
        return {...photo,previewUrl:URL.createObjectURL(await previewResponse.blob()),originalUrl:URL.createObjectURL(await originalResponse.blob())};
      }));
      defectPhotos.forEach((photo)=>{URL.revokeObjectURL(photo.previewUrl);URL.revokeObjectURL(photo.originalUrl);});
      setDefectPhotos(photos);
      setPhotoGalleryOpen(true);
    }catch(e){setError((e as Error).message);}
  }
  function closeDefectPhotos(){defectPhotos.forEach((photo)=>{URL.revokeObjectURL(photo.previewUrl);URL.revokeObjectURL(photo.originalUrl);});setDefectPhotos([]);setPhotoGalleryOpen(false);}

  if(!token)return <main className="login-screen">
    <div className="login-left"><div className="brand brand-login"><span className="brand-mark"><Factory size={21}/></span><span>FORGE<span className="brand-light">QUALITY</span></span></div><div className="login-message"><div className="eyebrow"><span className="live-dot"/> PLANT INTELLIGENCE PLATFORM</div><h1>Manufacturing,<br/><span>in clear view.</span></h1><p>One connected workspace for production performance, product quality, and equipment reliability.</p><div className="login-proof"><span><ShieldCheck size={17}/> Trace every batch</span><span><Activity size={17}/> Catch issues early</span></div></div><div className="login-footer">QUALITY OPERATIONS · BUILT FOR THE FACTORY FLOOR</div></div>
    <section className="login-panel"><form className="login-form" onSubmit={signIn}><div className="eyebrow">WELCOME BACK</div><h2>Sign in to your workspace</h2><p>Use your plant credentials to continue.</p>{error&&<div className="alert">{error}</div>}<label>Username<input name="username" required autoComplete="username" placeholder="Your username"/></label><label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password"/></label><button className="primary-button login-button" disabled={busy}>{busy?"Signing in…":"Sign in to workspace"}</button><div className="login-hint"><ShieldCheck size={15}/> Protected by role-based access</div><div className="login-hint">Administrator credentials are configured for this deployment.</div></form><div className="login-copyright">ForgeQuality · Manufacturing intelligence</div></section>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><Factory size={20}/></span><span>FORGE<span className="brand-light">QUALITY</span></span></div><div className="plant-select"><span className="plant-icon"><Factory size={16}/></span><span><small>ACTIVE FACILITY</small><b>North Plant</b></span><ChevronDown size={14} className="muted-icon"/></div><nav>{(["WORKSPACE","OPERATIONS","ASSET CARE","INSIGHTS"]).map((section)=><div className="nav-section" key={section}><div className="nav-heading">{section}</div>{navItems.filter((item)=>item.section===section).map(({title,icon:Icon})=><button key={title} className={`nav-item ${page===title?"selected":""}`} onClick={()=>{setPage(title);setSearch("");setError("");}}><Icon size={17}/><span>{title}</span>{title==="Nonconformance"&&dashboard.defective_units>0&&<i className="nav-count">{dashboard.defective_units}</i>}</button>)}</div>)}</nav><div className="sidebar-bottom"><div className="plant-status"><span className="live-dot"/> All systems operational</div><div className="user-card"><div className="avatar">{username.slice(0,1).toUpperCase()}</div><div className="user-meta"><b>{username}</b><span>{labelize(role)}</span></div><button className="icon-button logout" aria-label="Sign out" onClick={signOut}><LogOut size={16}/></button></div></div></aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs">North Plant <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="shift-chip"><span className="live-dot"/> LIVE OPERATIONS</span><span className="top-date">{new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</span><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/>{dashboard.open_issues>0&&<i/>}</button><div className="avatar small-avatar">{username.slice(0,1).toUpperCase()}</div></div></header>
    <div className="content">{error&&<div className="alert global-alert"><AlertTriangle size={16}/>{String(error)}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}{notice&&<div className="notice"><CheckCircle2 size={16}/>{notice}</div>}
    {page==="Overview"?<DashboardView data={dashboard} onNavigate={setPage}/>:page==="Reports"?<ReportsView token={token}/>:entity?<EntityView entity={entity} records={records} search={search} setSearch={setSearch} onCreate={()=>{setComposerEntity(entity);setEditingRecordId(null);setPendingPhotoDefectId(null);setExistingPhotoCount(0);setForm({});setSelectedPhotos([]);setModal(true);}} onEdit={editRecord} canEdit={canEditRecord(entity,role)} onUpdate={updateStatus} onQr={loadQr} onDetails={loadEquipment} onPhotos={loadDefectPhotos} onMakeDefect={createDefectFromInspection}/>:null}
    </div></main>
    {modal&&composerEntity&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setModal(false);}}><section className={`modal ${composerEntity==="defects"?"defect-modal":""}`}><div className="modal-header"><div><div className="eyebrow">{editingRecordId===null?"NEW RECORD":"EDIT RECORD"}</div><h2>{editingRecordId===null?"Create":"Edit"} {configs[composerEntity].singular.toLowerCase()}</h2><p>Capture a traceable record for North Plant.</p></div><button className="icon-button" onClick={()=>setModal(false)} aria-label="Close form"><X size={19}/></button></div><form onSubmit={save}><div className="form-grid">{configs[composerEntity].fields.map((field)=><label className={field.type==="textarea"?"wide-field":""} key={field.key}>{field.label}{field.type==="textarea"?<textarea value={String(form[field.key]??"")} onChange={(e)=>setForm({...form,[field.key]:e.target.value})} required={field.required}/>:field.options?<select value={String(form[field.key]??field.options[0])} onChange={(e)=>setForm({...form,[field.key]:e.target.value})} required={field.required}>{field.options.map((option)=><option key={option}>{option}</option>)}</select>:<input type={field.type??"text"} min={field.min} value={field.type==="checkbox"?undefined:String(form[field.key]??"")} checked={field.type==="checkbox"?Boolean(form[field.key]):undefined} onChange={(e)=>setForm({...form,[field.key]:field.type==="checkbox"?e.target.checked:e.target.value})} required={field.required}/>}</label>)}</div>{composerEntity==="defects"&&<PhotoUploadSection photos={selectedPhotos} setPhotos={setSelectedPhotos} dragging={draggingPhotos} setDragging={setDraggingPhotos} existingCount={existingPhotoCount}/>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setModal(false)}>Cancel</button><button className="primary-button" disabled={busy}><Plus size={16}/>{busy?"Saving…":editingRecordId===null?"Create record":"Save changes"}</button></div></form></section></div>}
    {photoGalleryOpen&&<PhotoGallery photos={defectPhotos} onClose={closeDefectPhotos}/>}
    {selectedAsset&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelectedAsset(null);}}><section className="asset-modal"><div className="modal-header"><div><div className="eyebrow">EQUIPMENT ASSET · {String(selectedAsset.equipment_code)}</div><h2>{String(selectedAsset.name)}</h2><p>{String(selectedAsset.location||"Location not specified")} · {String(selectedAsset.line||"No production line")}</p></div><button className="icon-button" onClick={()=>setSelectedAsset(null)} aria-label="Close equipment details"><X size={19}/></button></div><div className="asset-summary"><span className={`badge ${badgeTone(selectedAsset.status)}`}><i/>{String(selectedAsset.status)}</span><span>{String(selectedAsset.manufacturer||"Manufacturer not specified")} {String(selectedAsset.model||"")}</span><span>Criticality: <b>{String(selectedAsset.criticality)}</b></span><span>Service due: <b>{String(selectedAsset.maintenance_due||"Not scheduled")}</b></span></div><div className="asset-history">{(["issues","downtime","maintenance"] as const).map((group)=><section key={group}><h3>{labelize(group)} <span>{assetHistory?.[group].length??0}</span></h3>{assetHistory?.[group].length?assetHistory[group].slice(0,4).map((entry)=><div className="history-row" key={String(entry.id)}><b>{String(entry.problem??entry.reason??entry.title)}</b><small>{display(entry.status??entry.started_at??entry.due_date)} · {display(entry.severity??entry.work_type??(entry.planned?"Planned":"Unplanned"))}</small></div>):<p className="history-empty">No recorded {group}.</p>}</section>)}</div><div className="modal-footer"><button className="secondary-button" onClick={()=>{void loadQr(selectedAsset);}}>Show QR code</button><button className="primary-button" onClick={reportAssetIssue}><Wrench size={15}/> Report equipment issue</button></div></section></div>}
    {qr&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setQr(null);}}><section className="qr-modal"><button className="icon-button qr-close" onClick={()=>setQr(null)} aria-label="Close QR code"><X size={19}/></button><div className="eyebrow">EQUIPMENT IDENTIFICATION</div><h2>{qr.name}</h2><img src={qr.src} alt={`Equipment QR code for ${qr.name}`}/><p>Scan to open this equipment's asset record.</p></section></div>}
  </div>;
}

export function PhotoUploadSection({photos,setPhotos,dragging,setDragging,existingCount}:{photos:File[];setPhotos:(photos:File[])=>void;dragging:boolean;setDragging:(dragging:boolean)=>void;existingCount:number}){
  const [uploadError,setUploadError]=useState("");
  const previews=useMemo(()=>photos.map((file)=>({file,url:URL.createObjectURL(file)})),[photos]);
  useEffect(()=>()=>{previews.forEach((preview)=>URL.revokeObjectURL(preview.url));},[previews]);
  function addPhotos(input:FileList|File[]){
    const incoming=Array.from(input);
    const invalidType=incoming.find((file)=>!file.type.toLowerCase().startsWith("image/"));
    if(invalidType){setUploadError(`${invalidType.name} is not a recognized photo. Choose image files.`);return;}
    const tooLarge=incoming.find((file)=>file.size>maxPhotoBytes);
    if(tooLarge){setUploadError(`${tooLarge.name} is larger than the 10 MB per-photo limit.`);return;}
    const unique=incoming.filter((file)=>!photos.some((photo)=>photo.name===file.name&&photo.size===file.size&&photo.lastModified===file.lastModified));
    if(existingCount+photos.length+unique.length>maxDefectPhotos){setUploadError(`This report has ${existingCount} saved photos. It can include up to ${maxDefectPhotos} total.`);return;}
    setUploadError("");setPhotos([...photos,...unique]);
  }
  return <section className="defect-photo-section">
    <div className="photo-section-heading"><span className="photo-section-icon"><ImagePlus size={17}/></span><div><b>Defect photos</b><small>Attach clear photos to support investigation and traceability.</small></div><span className="photo-counter">{existingCount+photos.length}/{maxDefectPhotos}</span></div>
    <label className={`photo-dropzone ${dragging?"drag-active":""}`} onDragEnter={(event)=>{event.preventDefault();setDragging(true);}} onDragOver={(event)=>{event.preventDefault();setDragging(true);}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false);}} onDrop={(event)=>{event.preventDefault();setDragging(false);addPhotos(event.dataTransfer.files);}}>
      <input className="photo-input" type="file" accept="image/*" multiple onChange={(event)=>{if(event.target.files)addPhotos(event.target.files);event.currentTarget.value="";}}/>
      <span className="upload-cloud"><UploadCloud size={21}/></span><span className="dropzone-title">Drop photos here, or <b>browse files</b></span><span className="dropzone-help">Choose multiple photos from this device or take one with your camera.</span><span className="dropzone-formats">JPG · PNG · WEBP · GIF · TIFF · HEIC · more image formats · 10 MB each</span>
    </label>
    {uploadError&&<div className="photo-upload-error" role="alert">{uploadError}</div>}
    {previews.length>0&&<div className="selected-photo-grid">{previews.map(({file,url})=><article className="selected-photo-card" key={`${file.name}-${file.size}-${file.lastModified}`}><div className="selected-photo-preview"><img src={url} alt={`Preview of ${file.name}`} onError={(event)=>{event.currentTarget.style.display="none";event.currentTarget.parentElement?.classList.add("preview-unavailable");}}/><ImagePlus size={18}/><span>Preview after upload</span></div><div className="selected-photo-info"><span title={file.name}>{file.name}</span><small>{(file.size/1024/1024).toFixed(2)} MB</small></div><button type="button" className="photo-remove" aria-label={`Remove ${file.name}`} onClick={()=>setPhotos(photos.filter((photo)=>photo!==file))}><Trash2 size={14}/></button></article>)}</div>}
  </section>;
}

function PhotoGallery({photos,onClose}:{photos:DefectPhoto[];onClose:()=>void}){
  return <div className="modal-backdrop photo-gallery-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="photo-gallery-modal" role="dialog" aria-modal="true" aria-label="Defect photo evidence"><div className="modal-header"><div><div className="eyebrow">QUALITY EVIDENCE</div><h2>Defect photos</h2><p>{photos.length} attached {photos.length===1?"photo":"photos"} · original files preserved</p></div><button className="icon-button" onClick={onClose} aria-label="Close photo gallery"><X size={19}/></button></div>{photos.length>0?<div className="saved-photo-grid">{photos.map((photo)=><article className="saved-photo-card" key={photo.id}><a href={photo.originalUrl} target="_blank" rel="noreferrer" aria-label={`Open original ${photo.file_name}`}><img src={photo.previewUrl} alt={`Defect evidence: ${photo.file_name}`}/></a><div className="saved-photo-caption"><span title={photo.file_name}>{photo.file_name}</span><small>{(photo.file_size/1024/1024).toFixed(2)} MB · {photo.media_type}</small><a className="download-photo" href={photo.originalUrl} download={photo.file_name}><Download size={13}/> Download original</a></div></article>)}</div>:<div className="photo-gallery-empty"><ImagePlus size={26}/><b>No photos attached yet</b><span>Edit the defect report to add photo evidence.</span></div>}<div className="modal-footer"><button className="secondary-button" onClick={onClose}>Close</button></div></section></div>;
}

function DashboardView({data,onNavigate}:{data:Dashboard;onNavigate:(page:string)=>void}){
  const kpis=[{label:"Units produced",value:data.total_production.toLocaleString(),meta:`${data.good_units.toLocaleString()} good units`,icon:Boxes,tone:"blue",trend:"Production",up:true},{label:"First-pass yield",value:`${data.yield_percent}%`,meta:"Good units ÷ total produced",icon:Gauge,tone:"green",trend:"Yield",up:true},{label:"Defective units",value:data.defective_units.toLocaleString(),meta:`${data.defect_rate}% defect rate`,icon:AlertTriangle,tone:"red",trend:"Quality",up:false},{label:"Unplanned downtime",value:`${data.unplanned_downtime_hours}h`,meta:data.mttr_hours===null?"MTTR: awaiting repair history":`MTTR ${data.mttr_hours}h · ${data.open_issues} open issues`,icon:Clock3,tone:"amber",trend:"Reliability",up:false}];
  return <><div className="page-heading"><div><div className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase()} · PRODUCTION OVERVIEW</div><h1>Plant overview</h1><p>Your plant at a glance. Here’s what’s happening on the floor.</p></div><button className="date-button"><Clock3 size={15}/> All recorded data <ChevronDown size={14}/></button></div>
    <div className="kpi-grid">{kpis.map(({label,value,meta,icon:Icon,tone,trend,up})=><article className="kpi-card" key={label}><div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={17}/></span></div><div className="kpi-value">{value}</div><div className="kpi-meta"><span>{meta}</span><span className={`trend ${up?"positive":"subtle"}`}>{up?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{trend}</span></div></article>)}</div>
    <div className="dashboard-grid"><section className="card production-chart"><div className="card-heading"><div><h2>Production by line</h2><p>Actual units produced vs. target</p></div><span className="period-chip">CURRENT PERIOD</span></div>{data.production_by_line.length?<ResponsiveContainer width="100%" height={260}><AreaChart data={data.production_by_line} margin={{top:10,right:10,left:-18,bottom:0}}><defs><linearGradient id="producedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c85a32" stopOpacity={0.25}/><stop offset="100%" stopColor="#c85a32" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e6dfd3" vertical={false}/><XAxis dataKey="line" tickLine={false} axisLine={false} tick={{fill:"#857a6c",fontSize:11}} dy={10}/><YAxis tickLine={false} axisLine={false} tick={{fill:"#857a6c",fontSize:11}}/><Tooltip contentStyle={{borderRadius:10,border:"1px solid #ddd5c7",fontSize:12}}/><Area type="monotone" dataKey="target" name="Target units" stroke="#a69b8d" strokeDasharray="5 5" fill="transparent" strokeWidth={2}/><Area type="monotone" dataKey="produced" name="Units produced" stroke="#c85a32" fill="url(#producedFill)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer>:<EmptyState title="Production data will appear here" text="Log a production record to begin monitoring line performance."/>}<div className="chart-legend"><span><i className="legend-dot blue-dot"/> Actual production</span><span><i className="legend-line"/> Target</span></div></section>
    <section className="card quality-card"><div className="card-heading"><div><h2>Quality pulse</h2><p>Inspection outcomes across the plant</p></div><span className="subtle-icon"><ShieldCheck size={18}/></span></div><div className="quality-score"><div className="donut" style={{background:`conic-gradient(#3f7954 ${data.inspection_pass_rate}%, #edf0f4 ${data.inspection_pass_rate}%)`}}><div><b>{data.inspection_pass_rate}%</b><span>Pass rate</span></div></div></div><div className="quality-stats"><div><span className="quality-key"><i className="legend-dot green-dot"/> Passed inspections</span><b>{data.inspection_pass_rate}%</b></div><div><span className="quality-key"><i className="legend-dot red-dot"/> Defective units</span><b>{data.defective_units.toLocaleString()}</b></div><div><span className="quality-key"><i className="legend-dot amber-dot"/> Awaiting inspection</span><b>{data.awaiting_inspection.toLocaleString()}</b></div></div></section>
    <section className="card recent-card"><div className="card-heading"><div><h2>Recent nonconformance</h2><p>Latest reported quality issues</p></div><button className="text-button" onClick={()=>onNavigate("Nonconformance")}>View all <span>→</span></button></div>{data.recent_defects.length?<div className="table-scroll"><table><thead><tr><th>ISSUE ID</th><th>PRODUCT / BATCH</th><th>CATEGORY</th><th>SEVERITY</th><th>STATUS</th></tr></thead><tbody>{data.recent_defects.map((row)=><tr key={String(row.id)}><td className="record-id">{String(row.defect_number)}</td><td><b>{String(row.product)}</b><small>{String(row.batch)}</small></td><td>{String(row.category)}</td><td><span className={`badge ${badgeTone(row.severity)}`}>{String(row.severity)}</span></td><td><span className={`badge ${badgeTone(row.status)}`}><i/> {String(row.status)}</span></td></tr>)}</tbody></table></div>:<EmptyState title="No quality issues reported" text="New defect reports will show here."/>}</section>
    <section className="card reliability-card"><div className="card-heading"><div><h2>Asset reliability</h2><p>Plant equipment health</p></div><button className="text-button" onClick={()=>onNavigate("Equipment")}>Equipment <span>→</span></button></div><div className="reliability-number">{data.equipment_total?Math.round(data.equipment_operational/data.equipment_total*100):0}<span>%</span></div><div className="reliability-copy">{data.equipment_operational} of {data.equipment_total} assets operational</div><div className="progress-track"><span style={{width:`${data.equipment_total?data.equipment_operational/data.equipment_total*100:0}%`}}/></div><div className="reliability-footer"><span><i className="legend-dot green-dot"/> Operational</span><b>{data.equipment_operational}</b><span><i className="legend-dot amber-dot"/> Maintenance queue</span><b>{data.maintenance_backlog}</b></div></section></div>
  </>;
}

function EntityView({entity,records,search,setSearch,onCreate,onEdit,canEdit,onUpdate,onQr,onDetails,onPhotos,onMakeDefect}:{entity:Entity;records:Record<string,unknown>[];search:string;setSearch:(value:string)=>void;onCreate:()=>void;onEdit:(row:Record<string,unknown>)=>void;canEdit:boolean;onUpdate:(id:number,status:string)=>void;onQr:(row:Record<string,unknown>)=>void;onDetails:(row:Record<string,unknown>)=>void;onPhotos:(row:Record<string,unknown>)=>void;onMakeDefect:(row:Record<string,unknown>)=>void}){
  const config=configs[entity];const Icon=config.icon;
  return <>
    <div className="page-heading"><div><div className="eyebrow">NORTH PLANT · OPERATIONS</div><h1>{config.label}</h1><p>Review, search, and manage {config.label.toLowerCase()} records across your facility.</p></div><button className="primary-button" onClick={onCreate}><Plus size={16}/> Add {config.singular.toLowerCase()}</button></div>
    <section className="card records-card">
      <div className="records-toolbar"><div className="section-title"><span className="section-icon"><Icon size={17}/></span><div><b>{config.label} register</b><small>{records.length} records shown</small></div></div><label className="search-box"><Search size={16}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search records…"/></label></div>
      {records.length?<div className="table-scroll"><table><thead><tr>{config.columns.map((column)=><th key={column}>{labelize(column).toUpperCase()}</th>)}<th>ACTIONS</th></tr></thead><tbody>{records.map((row)=><tr key={String(row.id)}>
        {config.columns.map((column)=><td key={column}>{["status","severity","result","priority"].includes(column)?<span className={`badge ${badgeTone(row[column])}`}><i/> {display(row[column])}</span>:column==="problem"||column==="description"?<span className="truncate-cell" title={String(row[column])}>{display(row[column])}</span>:column==="name"||column==="title"||column==="product"?<b>{display(row[column])}</b>:<span className={column.includes("number")||column==="equipment_code"?"record-id":""}>{display(row[column])}</span>}</td>)}
        <td><div className="row-actions">
          {canEdit&&<button className="small-action" onClick={()=>onEdit(row)}>Edit</button>}
          {entity==="defects"&&<button className="small-action" onClick={()=>onPhotos(row)}>{Number(row.image_count??0)>0?`Photos (${row.image_count})`:"Add photos"}</button>}
          {entity==="equipment"&&<button className="small-action" onClick={()=>onDetails(row)}>Details</button>}
          {entity==="equipment"&&<button className="small-action" onClick={()=>onQr(row)}>QR</button>}
          {entity==="inspections"&&row.result==="Fail"&&<button className="small-action" onClick={()=>onMakeDefect(row)}>Create NC</button>}
          {entity==="defects"&&row.status!=="Closed"&&<button className="small-action" onClick={()=>onUpdate(Number(row.id),"Closed")}>Close</button>}
          {entity==="issues"&&row.status!=="Resolved"&&<button className="small-action" onClick={()=>onUpdate(Number(row.id),"Resolved")}>Resolve</button>}
          {entity==="maintenance"&&row.status!=="Completed"&&<button className="small-action" onClick={()=>onUpdate(Number(row.id),"Completed")}>Complete</button>}
          {entity==="downtime"&&!row.ended_at&&<button className="small-action" onClick={()=>onUpdate(Number(row.id),"Completed")}>End event</button>}
        </div></td>
      </tr>)}</tbody></table></div>:<EmptyState title={search?"No matching records":"Your register is ready"} text={search?"Try a different search term or clear your search.":`Create your first ${config.singular.toLowerCase()} to start building a traceable history.`}/>}
    </section>
    <div className="register-note"><ShieldCheck size={15}/> Records are searchable and linked to production and quality history.</div>
  </>;
}

function ReportsView({token}:{token:string}){
  const [report,setReport]=useState<{defects_by_category:{category:string;count:number}[];downtime_hours:number;defect_count:number;overdue_investigations:number}|null>(null);
  const [failure,setFailure]=useState("");
  useEffect(()=>{request<typeof report>("/reports/summary",token).then(setReport).catch((e)=>setFailure((e as Error).message));},[token]);
  const metrics=useMemo(()=>report??{defects_by_category:[],downtime_hours:0,defect_count:0,overdue_investigations:0},[report]);
  return <><div className="page-heading"><div><div className="eyebrow">PLANT PERFORMANCE · INSIGHTS</div><h1>Reports &amp; trends</h1><p>Quality and equipment signals to guide your next action.</p></div><span className="period-chip report-period"><Clock3 size={13}/> ALL RECORDED DATA</span></div>{failure&&<div className="alert">{failure}</div>}<div className="report-kpis"><article className="card report-stat"><span>Reported nonconformances</span><b>{metrics.defect_count}</b><small>Recorded defect investigations</small></article><article className="card report-stat"><span>Downtime to date</span><b>{metrics.downtime_hours} <small>hrs</small></b><small>Overlapping events are summed individually</small></article><article className="card report-stat"><span>Overdue investigations</span><b className={metrics.overdue_investigations?"red-text":""}>{metrics.overdue_investigations}</b><small>Open beyond the assigned due date</small></article></div><section className="card report-table"><div className="card-heading"><div><h2>Defects by category</h2><p>Defective quantity grouped by reported category</p></div></div>{metrics.defects_by_category.length?<div className="table-scroll"><table><thead><tr><th>DEFECT CATEGORY</th><th>DEFECTIVE UNITS</th><th>SHARE</th></tr></thead><tbody>{metrics.defects_by_category.map((item)=><tr key={item.category}><td><b>{item.category}</b></td><td>{item.count}</td><td><div className="mini-progress"><span style={{width:`${metrics.defect_count?Math.min(100,item.count/metrics.defect_count*100):0}%`}}/></div></td></tr>)}</tbody></table></div>:<EmptyState title="No defect data yet" text="Log a nonconformance to populate quality trend reporting."/>}</section><div className="kpi-definition"><b>KPI definitions</b><p><strong>Yield</strong> = good units ÷ actual units produced. <strong>Defect rate</strong> = reported defective quantity ÷ inspected quantity recorded on defect reports. <strong>Downtime</strong> sums event durations and currently does not de-duplicate overlapping events; availability and MTBF are not reported until reliable planned operating-time data is available.</p></div></>;
}

function EmptyState({title,text}:{title:string;text:string}){return <div className="empty-state"><span><BriefcaseBusiness size={20}/></span><b>{title}</b><p>{text}</p></div>;}
