import React, { useState, useEffect, useRef } from 'react';
// 🟢 [正式部署]: 部署到 Vercel/GitHub 时，请务必取消下一行的注释！
import { createClient } from '@supabase/supabase-js';
import { 
  Beaker, Clock, User, CheckCircle, XCircle, 
  Plus, Trash2, Search, Upload, Camera, Menu, X, Settings,
  LogOut, Calendar as CalendarIcon, Users, UserPlus,
  ShieldAlert, ShieldCheck, Ban, Key, ChevronUp, Clock4, Crown, FileText,
  MousePointerClick, Edit3, Filter, ArrowUpDown, LayoutGrid, ClipboardList, Eye,
  ChevronLeft, ChevronRight, Info, Save, ArrowLeft, CalendarDays
} from 'lucide-react';

// 🔴 请务必替换为您在 Supabase Settings -> API 获取的真实数据
const SUPABASE_URL = "https://rcmogvyepjhwexeojjuy.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbW9ndnllcGpod2V4ZW9qanV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzgwNjksImV4cCI6MjA4NDY1NDA2OX0.UIYJABF3-V3_po_xdfDhQK394_jEsxF6MPxBhsqLpZk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_RULES = {
  maxDuration: 4, weekendOpen: true, needAudit: false, maxAdvanceDays: 7, minCancelHours: 2  
};

// 布局常量
const GRID_HEIGHT = 1440; // 24小时 * 60px/小时
const HEADER_HEIGHT_STYLE = { height: '50px' }; 

// 工具函数
const generateColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsla(${hue}, 70%, 90%, 0.95)`, border: `hsla(${hue}, 60%, 40%, 0.8)`, text: `hsla(${hue}, 80%, 20%, 1)` };
};

const formatDate = (d) => d.toISOString().split('T')[0];
const addDays = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };

// 中文日期格式化
const formatDateTimeCN = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${timeStr}`;
};

// 0-24小时映射到像素位置
const timeToPx = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  if (h === 24) return GRID_HEIGHT;
  return (h * 60 + m) * (GRID_HEIGHT / 1440);
};

// 像素映射到时间 (分钟)
const pxToTimeStr = (px) => {
  let totalMins = Math.floor((px / GRID_HEIGHT) * 1440);
  totalMins = Math.max(0, Math.min(1440, totalMins)); 
  const remainder = totalMins % 15;
  if (remainder < 7.5) totalMins -= remainder; else totalMins += (15 - remainder);
  
  let h = Math.floor(totalMins / 60);
  let m = totalMins % 60;
  if (h === 24) return "24:00"; 
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
};

export default function App() {
  const [userRole, setUserRole] = useState("guest"); 
  const [currentUser, setCurrentUser] = useState(null); 
  const [adminPassword, setAdminPassword] = useState("admin888");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const [equipmentList, setEquipmentList] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [userList, setUserList] = useState([]); 
  const [globalRules, setGlobalRules] = useState(DEFAULT_RULES);
  const [ruleId, setRuleId] = useState(null);

  const [mainView, setMainView] = useState("dashboard");
  const [adminTab, setAdminTab] = useState("equipments");
  const [selectedEq, setSelectedEq] = useState(null); 
  
  const [modals, setModals] = useState({ eq:false, rule:false, pwd:false, user:false, limit:false });
  
  const [authMode, setAuthMode] = useState("login"); 
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [regForm, setRegForm] = useState({ username: "", password: "", confirmPass: "" });
  const [bookingForm, setBookingForm] = useState({ id: null, startDate: "", startTime: "", endDate: "", endTime: "", note: "" }); 
  const [eqForm, setEqForm] = useState({ name: "", type: "", location: "", status: "active", image: null });
  const [previewImage, setPreviewImage] = useState("");
  const [newUserForm, setNewUserForm] = useState({ username: "", password: "" });
  const [pwdForm, setPwdForm] = useState({ oldPass: "", newPass: "", confirmPass: "" });
  const [limitForm, setLimitForm] = useState({ userId: null, username: "", hours: "" });

  const [dragState, setDragState] = useState({ isDragging: false, dayIndex: null, startY: 0, currentY: 0 });
  const [weekStart, setWeekStart] = useState(new Date()); 
  const fileInputRef = useRef(null);
  const timelineRef = useRef(null);

  // 新增：详情弹窗状态
  const [detailModal, setDetailModal] = useState(null);

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({ status: 'all', equipmentId: 'all' });

  useEffect(() => { refreshData(); }, [userRole]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const { data: rules } = await supabase.from('GlobalSettings').select('*');
      if (rules && rules.length > 0) {
        const ruleObj = rules[0];
        setGlobalRules({ ...DEFAULT_RULES, ...ruleObj });
        setRuleId(ruleObj.id);
        if (ruleObj.adminPassword) setAdminPassword(ruleObj.adminPassword);
      }

      if (userRole !== 'guest') {
        const { data: eqs } = await supabase.from('Equipment').select('*').order('created_at', { ascending: false });
        if(eqs) setEquipmentList(eqs);
        const { data: ress } = await supabase.from('Reservations').select('*').order('created_at', { ascending: false });
        if(ress) setReservations(ress);
        if (userRole === 'admin') {
            const { data: users } = await supabase.from('AppUser').select('*').order('created_at', { ascending: false });
            if(users) setUserList(users);
        }
      }
    } catch (e) { 
      console.error(e);
      showToast("数据加载异常，请检查网络或配置", "error"); 
    }
    setLoading(false);
  };

  const showToast = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 拖拽交互 ---
  const handlePointerDown = (dayIndex, e) => {
    if (currentUser?.isBlocked) return showToast("账号被封禁", "error");
    if (!e.target.classList.contains('timeline-bg')) return; 

    e.currentTarget.setPointerCapture(e.pointerId); 
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    setDragState({ isDragging: true, dayIndex, startY: relativeY, currentY: relativeY });
  };

  const handlePointerMove = (e) => {
    if (!dragState.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let relativeY = e.clientY - rect.top;
    relativeY = Math.max(0, Math.min(GRID_HEIGHT, relativeY)); // Clamp
    setDragState(prev => ({ ...prev, currentY: relativeY }));
  };

  const handlePointerUp = (e) => {
    if (!dragState.isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const startY = dragState.startY;
    const endY = dragState.currentY;

    let startMin = Math.floor((Math.min(startY, endY) / GRID_HEIGHT) * 1440);
    let endMin = Math.floor((Math.max(startY, endY) / GRID_HEIGHT) * 1440);

    // 吸附
    startMin = Math.round(startMin / 15) * 15;
    endMin = Math.round(endMin / 15) * 15;

    if (endMin - startMin < 30) endMin = startMin + 30;
    if (endMin > 1440) endMin = 1440;

    const dateStr = formatDate(addDays(weekStart, dragState.dayIndex));
    
    const formatTime = (m) => {
        if(m===1440) return "24:00"; 
        const hh = Math.floor(m/60).toString().padStart(2,'0');
        const mm = (m%60).toString().padStart(2,'0');
        return `${hh}:${mm}`;
    };

    setBookingForm({
        id: null,
        startDate: dateStr,
        startTime: formatTime(startMin),
        endDate: dateStr,
        endTime: formatTime(endMin),
        note: ""
    });
    setModals(prev => ({ ...prev, booking: true }));
    setDragState({ isDragging: false, dayIndex: null, startY: 0, currentY: 0 });
  };

  // --- 提交预约 ---
  const submitBooking = async () => {
    if (currentUser?.isBlocked) return showToast("账号被封禁", "error");
    const { id, startDate, startTime, endDate, endTime, note } = bookingForm;
    if (!startDate || !startTime || !endDate || !endTime) return showToast("请完整填写时间", "error");

    const startT = new Date(`${startDate}T${startTime === '24:00' ? '23:59:59' : startTime}`); 
    let endT = new Date(`${endDate}T${endTime === '24:00' ? '23:59:59' : endTime}`);
    if(endTime === '24:00') endT.setMilliseconds(999);

    const now = new Date();
    const duration = (endT - startT) / 36e5;
    const maxDate = addDays(new Date(), globalRules.maxAdvanceDays);

    if (endT <= startT) return showToast("结束时间必须晚于开始时间", "error");
    if (!id && startT < now) return showToast("不能预约过去的时间", "error");
    if (startT > maxDate) return showToast(`只能提前 ${globalRules.maxAdvanceDays} 天预约`, "error");

    let limit = currentUser?.bookingLimit || globalRules.maxDuration;
    if (duration > limit) return showToast(`超限：您最大可预约 ${limit} 小时`, "error");

    const isConflict = reservations.some(r => {
      if (id && r.id === id) return false; 
      if (r.equipmentId !== selectedEq.id || r.status === 'rejected') return false;
      const rStart = new Date(`${r.date}T${r.startTime}`);
      let rEnd = new Date(`${r.endDate||r.date}T${r.endTime}`);
      if (!r.endDate && rEnd <= rStart) rEnd.setDate(rEnd.getDate() + 1);
      return (startT < rEnd && endT > rStart);
    });
    if (isConflict) return showToast("该时段已被占用", "error");

    setLoading(true);
    try {
      const payload = { 
          equipmentId: selectedEq.id, 
          equipmentName: selectedEq.name, 
          user: currentUser.username, 
          date: startDate, 
          startTime, 
          endDate, 
          endTime, 
          note, 
          status: (userRole === 'admin' || !globalRules.needAudit) ? 'approved' : 'pending' 
      };

      if (id) await supabase.from('Reservations').update(payload).eq('id', id);
      else await supabase.from('Reservations').insert([payload]);
      
      await refreshData();
      showToast(id ? "修改成功" : "预约成功");
      setModals(prev => ({ ...prev, booking: false }));
    } catch (e) { showToast("操作失败", "error"); }
    setLoading(false);
  };

  // --- 通用处理 ---
  const handleLogin = async () => {
    setLoading(true);
    if (loginForm.username === 'admin' && loginForm.password === adminPassword) {
        setUserRole('admin');
        setCurrentUser({ username: '超级管理员', role: 'admin' });
    } else {
        const { data } = await supabase.from('AppUser').select('*').eq('username', loginForm.username);
        if (data?.[0] && data[0].password === loginForm.password) {
            const u = data[0];
            setUserRole(u.role==='admin'?'admin':'student');
            setCurrentUser({ ...u, isBlocked: !!u.isBlocked });
        } else { showToast("账号或密码错误", "error"); }
    }
    setLoading(false);
  };
  const handleRegister = async () => {
    if (regForm.password !== regForm.confirmPass) return showToast("密码不一致", "error");
    setLoading(true);
    const { data } = await supabase.from('AppUser').select('*').eq('username', regForm.username);
    if (data?.length) { showToast("用户名已存在", "error"); setLoading(false); return; }
    await supabase.from('AppUser').insert([{ username: regForm.username, password: regForm.password, role: 'student' }]);
    showToast("注册成功"); setAuthMode('login'); setLoading(false);
  };
  const handleSaveEquipment = async (e) => {
      e.preventDefault(); setLoading(true);
      let url = eqForm.imageUrl;
      if (eqForm.image instanceof File) {
          const name = `${Date.now()}_${eqForm.image.name}`;
          await supabase.storage.from('equipment-images').upload(name, eqForm.image);
          url = supabase.storage.from('equipment-images').getPublicUrl(name).data.publicUrl;
      }
      const p = { ...eqForm, imageUrl: url || "https://placehold.co/400x300", created_at: new Date() }; delete p.image;
      if(eqForm.id) await supabase.from('Equipment').update(p).eq('id', eqForm.id);
      else await supabase.from('Equipment').insert([p]);
      refreshData(); setModals({...modals, eq:false}); setLoading(false); showToast("设备已保存");
  };
  const handlePromote = async (u) => { await supabase.from('AppUser').update({ role: u.role==='admin'?'student':'admin' }).eq('id', u.id); refreshData(); showToast("权限变更"); };
  const handleLimitSave = async () => { await supabase.from('AppUser').update({ bookingLimit: limitForm.hours?parseFloat(limitForm.hours):null }).eq('id', limitForm.userId); refreshData(); setModals({...modals,limit:false}); showToast("限制已保存"); };
  const saveRules = async () => { setLoading(true); const p={...globalRules}; delete p.id; delete p.created_at; if(ruleId) await supabase.from('GlobalSettings').update(p).eq('id', ruleId); else await supabase.from('GlobalSettings').insert([p]); setLoading(false); setModals({...modals,rule:false}); showToast("规则已保存"); };
  const handleCancelBooking = async (res) => { if(!confirm("取消预约?"))return; await supabase.from('Reservations').delete().eq('id', res.id); refreshData(); showToast("已取消"); };
  const handleEditBooking = (res) => { setBookingForm({ id:res.id, startDate:res.date, startTime:res.startTime, endDate:res.endDate||res.date, endTime:res.endTime, note:res.note||"" }); setModals(p => ({...p, booking: true})); };
  const handleChangePassword = async () => { 
      const { oldPass, newPass, confirmPass } = pwdForm;
      if (!oldPass || !newPass || !confirmPass) return showToast("请填写完整", "error");
      if (newPass !== confirmPass) return showToast("不一致", "error");
      setLoading(true);
      if (currentUser.username === '超级管理员') {
          if (oldPass !== adminPassword) { setLoading(false); return showToast("旧密码错误", "error"); }
          if (ruleId) await supabase.from('GlobalSettings').update({ adminPassword: newPass }).eq('id', ruleId);
          else await supabase.from('GlobalSettings').insert([{ adminPassword: newPass }]);
          setAdminPassword(newPass);
      } else {
          const { data: users } = await supabase.from('AppUser').select('*').eq('id', currentUser.id);
          if (users[0].password !== oldPass) { setLoading(false); return showToast("旧密码错误", "error"); }
          await supabase.from('AppUser').update({ password: newPass }).eq('id', currentUser.id);
      }
      showToast("密码修改成功"); setModals({...modals, pwd:false}); setLoading(false);
  };
  const handleAdminAddUser = async () => {
    setLoading(true); await supabase.from('AppUser').insert([{ username: newUserForm.username, password: newUserForm.password, role: 'student', isBlocked: false }]);
    refreshData(); setModals({...modals, user:false}); setLoading(false); showToast("用户添加成功");
  };
  const getFilteredReservations = (publicView) => {
    let data = [...reservations];
    if (publicView && userRole !== 'admin') {
       const now = new Date();
       data = data.filter(r => { let endD = r.endDate || r.date; return new Date(`${endD}T${r.endTime}`) >= new Date(); });
    }
    if (filterConfig.status !== 'all') data = data.filter(r => r.status === filterConfig.status);
    if (filterConfig.equipmentId !== 'all') data = data.filter(r => r.equipmentId == filterConfig.equipmentId);
    return data.sort((a, b) => new Date(`${b.date}T${b.startTime}`) - new Date(`${a.date}T${a.startTime}`));
  };

  const renderWeekCell = (dayIndex) => {
      const currentDate = addDays(weekStart, dayIndex);
      const cellStart = new Date(currentDate); cellStart.setHours(0,0,0,0);
      const cellEnd = new Date(currentDate); cellEnd.setHours(23,59,59,999);

      const dayReservations = reservations.filter(r => r.equipmentId === selectedEq.id && r.status !== 'rejected').filter(r => {
         const rS = new Date(`${r.date}T${r.startTime}`);
         let rEndDate = r.endDate || r.date;
         let rE = new Date(`${rEndDate}T${r.endTime}`);
         if(!r.endDate && rE <= rS) rE.setDate(rE.getDate()+1);
         return rS < cellEnd && rE > cellStart;
      });

      const isDragTarget = dragState.isDragging && dragState.dayIndex === dayIndex;

      return (
          <div 
            key={dayIndex} 
            className="flex-1 border-r border-slate-200 relative bg-white group cursor-crosshair hover:bg-slate-50 transition-colors touch-none timeline-bg"
            style={{ height: `${GRID_HEIGHT}px` }} 
            onPointerDown={(e) => handlePointerDown(dayIndex, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
             {[...Array(24)].map((_, i) => (
                 <div key={i} className="absolute w-full border-b border-slate-100 pointer-events-none" style={{ top: `${(i/24)*100}%` }}></div>
             ))}
             
             {dayReservations.map(r => {
                 const rS = new Date(`${r.date}T${r.startTime}`);
                 let rEndDate = r.endDate || r.date;
                 let rE = new Date(`${rEndDate}T${r.endTime}`);
                 if(!r.endDate && rE <= rS) rE.setDate(rE.getDate()+1);

                 const sTime = Math.max(rS.getTime(), cellStart.getTime());
                 const eTime = Math.min(rE.getTime(), cellEnd.getTime());
                 
                 const top = (sTime - cellStart.getTime()) / 60000;
                 const height = (eTime - sTime) / 60000;

                 if (height <= 0) return null;
                 const colors = generateColor(r.user);
                 
                 const startStr = formatDateTimeCN(r.date, r.startTime);
                 const endStr = formatDateTimeCN(r.endDate || r.date, r.endTime);

                 return (
                     <div 
                        key={r.id}
                        className="absolute left-1 right-1 rounded px-1.5 text-[10px] overflow-hidden shadow-sm pointer-events-auto cursor-pointer z-10 group/block hover:z-20 transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-start py-1 border-l-4"
                        style={{ top: `${top}px`, height: `${height}px`, backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setDetailModal(r); 
                        }}
                        title={`点击查看详情`}
                     >
                        <div className="font-bold truncate leading-tight">{startStr} 至 {endStr}</div>
                        <div className="truncate font-medium mt-0.5">👤 {r.user}</div>
                        {r.note && <div className="truncate opacity-70 italic mt-0.5">📝 {r.note}</div>}
                     </div>
                 );
             })}

             {isDragTarget && (
                <div className="absolute left-0 right-0 bg-blue-500/30 border-y-2 border-blue-500 z-30 pointer-events-none"
                     style={{ top: `${Math.min(dragState.startY, dragState.currentY)}px`, height: `${Math.abs(dragState.currentY - dragState.startY)}px` }} />
             )}
          </div>
      );
  };

  // --- Render ---

  if (userRole === 'guest') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-6 flex justify-center items-center gap-2"><Beaker className="text-blue-600"/> 实验室预约</h1>
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
           {['login','register'].map(m => <button key={m} onClick={()=>setAuthMode(m)} className={`flex-1 py-2 text-sm rounded ${authMode===m?'bg-white shadow text-blue-600':'text-slate-500'}`}>{m==='login'?'登录':'注册'}</button>)}
        </div>
        <div className="space-y-4">
           <input className="w-full p-3 border rounded" placeholder="用户名" value={authMode==='login'?loginForm.username:regForm.username} onChange={e=>authMode==='login'?setLoginForm({...loginForm,username:e.target.value}):setRegForm({...regForm,username:e.target.value})}/>
           <input type="password" className="w-full p-3 border rounded" placeholder="密码" value={authMode==='login'?loginForm.password:regForm.password} onChange={e=>authMode==='login'?setLoginForm({...loginForm,password:e.target.value}):setRegForm({...regForm,password:e.target.value})}/>
           {authMode==='register' && <input type="password" className="w-full p-3 border rounded" placeholder="确认密码" value={regForm.confirmPass} onChange={e=>setRegForm({...regForm,confirmPass:e.target.value})}/>}
           <button onClick={authMode==='login'?handleLogin:handleRegister} className="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700">{authMode==='login'?'立即登录':'注册账号'}</button>
        </div>
      </div>
      {notification && <div className="fixed bottom-8 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg">{notification.msg}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-white border-b sticky top-0 z-30 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 font-bold text-lg"><Beaker className="text-blue-600"/> LabManager</div>
        <div className="hidden md:flex bg-slate-100 p-1 rounded-lg text-sm font-medium">
           {[
             {id:'dashboard', icon:LayoutGrid, label:'设备大厅'},
             {id:'public_schedule', icon:Eye, label:'预约公示'},
             {id:'my_bookings', icon:Clock4, label:'我的预约'},
             ...(userRole==='admin'?[{id:'admin_panel', icon:ClipboardList, label:'管理后台'}]:[])
           ].map(tab => (
             <button key={tab.id} onClick={()=>setMainView(tab.id)} className={`px-4 py-1.5 rounded flex items-center gap-1 ${mainView===tab.id?'bg-white shadow text-blue-700':'text-slate-500 hover:text-slate-700'}`}>
               <tab.icon size={16}/> {tab.label}
             </button>
           ))}
        </div>
        <div className="flex items-center gap-4">
           <span className="text-sm font-bold flex items-center gap-1">{currentUser?.username} {currentUser?.role==='admin' && <Crown size={14} className="text-amber-500"/>}</span>
           <button onClick={()=>{setUserRole('guest');setCurrentUser(null);}}><LogOut size={20} className="text-slate-400 hover:text-red-600"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow z-50 text-sm text-blue-600 flex items-center gap-2">处理中...</div>}

        {/* 1. 设备大厅 */}
        {mainView === 'dashboard' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">设备预约大厅</h2>
                {userRole==='admin' && <button onClick={()=>{setEqForm({name:"",type:"",location:"",status:"active",image:null});setPreviewImage("");setModals({...modals,eq:true})}} className="bg-blue-600 text-white px-3 py-2 rounded flex gap-1 items-center hover:bg-blue-700"><Plus size={16}/> 添加设备</button>}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {equipmentList.map(item => (
                 <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-48 bg-slate-100 relative">
                       <img src={item.imageUrl} className="w-full h-full object-cover"/>
                       <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-white/90 ${item.status==='active'?'text-green-600':'text-red-500'}`}>{item.status==='active'?'可预约':'维护中'}</div>
                    </div>
                    <div className="p-4">
                       <h3 className="font-bold text-lg">{item.name}</h3>
                       <p className="text-xs text-slate-500 mt-1">{item.location} | {item.type}</p>
                       <button 
                         onClick={() => { setSelectedEq(item); setWeekStart(new Date()); setBookingForm({id:null, startDate:formatDate(new Date()), startTime:"", endDate:formatDate(new Date()), endTime:"", note:""}); }}
                         disabled={item.status!=='active'}
                         className={`w-full mt-4 py-2 rounded font-medium ${item.status==='active'?'bg-slate-900 text-white hover:bg-slate-800':'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                       >
                         {item.status==='active' ? '查看排期表 & 预约' : '暂停使用'}
                       </button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* 2. 预约公示 */}
        {mainView === 'public_schedule' && (
           <div className="space-y-4">
             <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold">预约公示 <span className="text-xs font-normal text-slate-500 ml-2">{userRole==='admin'?"(历史全量)":"(当前及未来)"}</span></h2>
                <div className="flex gap-2 text-sm">
                    <select className="border p-1.5 rounded" value={filterConfig.status} onChange={e=>setFilterConfig({...filterConfig, status:e.target.value})}>
                       <option value="all">所有状态</option><option value="approved">已通过</option><option value="pending">待审核</option>
                    </select>
                    <select className="border p-1.5 rounded max-w-[120px]" value={filterConfig.equipmentId} onChange={e=>setFilterConfig({...filterConfig, equipmentId:e.target.value})}>
                       <option value="all">所有设备</option>{equipmentList.map(eq=><option key={eq.id} value={eq.id}>{eq.name}</option>)}
                    </select>
                </div>
             </div>
             <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-500 border-b">
                   <tr>
                     {['equipmentName:设备','user:申请人','date:时间'].map(col=><th key={col} className="p-3 cursor-pointer" onClick={()=>setSortConfig({key:col.split(':')[0],direction:sortConfig.direction==='asc'?'desc':'asc'})}>{col.split(':')[1]} <ArrowUpDown size={12} className="inline"/></th>)}
                     <th className="p-3">状态</th>
                     {userRole==='admin' && <th className="p-3 text-right">操作</th>}
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {getFilteredReservations(true).map(res => (
                     <tr key={res.id} className="hover:bg-slate-50">
                       <td className="p-3">{res.equipmentName}</td>
                       <td className="p-3">{res.user}</td>
                       <td className="p-3">
                         <div>{res.date} {res.startTime} <span className="text-slate-400">至</span></div>
                         <div>{res.endDate||res.date} {res.endTime}</div>
                         {res.note && <div className="text-xs text-slate-500 mt-1 truncate max-w-[150px]">📝 {res.note}</div>}
                       </td>
                       <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs border ${res.status==='approved'?'bg-green-50 text-green-600 border-green-200':res.status==='pending'?'bg-amber-50 text-amber-600 border-amber-200':'bg-red-50 text-red-600 border-red-200'}`}>{res.status}</span></td>
                       {userRole==='admin' && <td className="p-3 text-right"><button onClick={()=>supabase.from('Reservations').update({status:'approved'}).eq('id',res.id).then(refreshData)} className="text-green-600 mr-2"><CheckCircle size={18}/></button><button onClick={()=>supabase.from('Reservations').update({status:'rejected'}).eq('id',res.id).then(refreshData)} className="text-red-600"><XCircle size={18}/></button></td>}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {/* 3. 我的预约 */}
        {mainView === 'my_bookings' && (
           <div className="grid gap-4">
             {reservations.filter(r => r.user === currentUser?.username).map(res => (
               <div key={res.id} className="bg-white p-4 rounded border shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-bold">{res.equipmentName} <span className="text-xs border px-1 ml-2 rounded">{res.status}</span></div>
                    <div className="text-sm text-slate-500">{res.date} {res.startTime} 至 {res.endDate||res.date} {res.endTime}</div>
                  </div>
                  {res.status!=='rejected' && <div className="flex gap-2"><button onClick={()=>handleEditBooking(res)} className="bg-slate-100 px-3 py-1 rounded text-xs">修改</button><button onClick={()=>handleCancelBooking(res)} className="text-red-500 border border-red-200 px-3 py-1 rounded text-xs">取消</button></div>}
               </div>
             ))}
           </div>
        )}

        {/* 4. 管理后台 */}
        {mainView === 'admin_panel' && userRole === 'admin' && (
           <div className="space-y-6">
              <div className="flex gap-4 border-b pb-2">
                 {['equipments:设备管理','users:用户权限','rules:规则设置'].map(t=><button key={t} onClick={()=>setAdminTab(t.split(':')[0])} className={`pb-2 px-2 text-sm font-medium ${adminTab===t.split(':')[0]?'text-blue-600 border-b-2 border-blue-600':'text-slate-500'}`}>{t.split(':')[1]}</button>)}
              </div>
              {adminTab === 'equipments' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {equipmentList.map(item => (
                     <div key={item.id} className="bg-white p-4 rounded border flex justify-between items-center">
                         <div><div className="font-bold">{item.name}</div><div className="text-xs text-slate-500">{item.location}</div></div>
                         <button onClick={()=>{if(confirm('删除?')) supabase.from('Equipment').delete().eq('id',item.id).then(refreshData)}} className="text-red-500"><Trash2 size={16}/></button>
                     </div>
                   ))}
                 </div>
              )}
              {adminTab === 'users' && (
                 <div className="bg-white rounded border overflow-hidden">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 border-b"><tr><th className="p-3">用户</th><th className="p-3">角色</th><th className="p-3">时长</th><th className="p-3 text-right">操作</th></tr></thead>
                       <tbody>{userList.map(u=>(<tr key={u.id}><td className="p-3">{u.username}</td><td className="p-3">{u.role}</td><td className="p-3">{u.bookingLimit||'默认'}</td><td className="p-3 text-right"><button onClick={()=>setLimitForm({userId:u.id,username:u.username,hours:u.bookingLimit||""})||setModals({...modals,limit:true})}><Clock4 size={14}/></button> <button onClick={()=>handlePromote(u)}><Crown size={14}/></button> <button onClick={()=>supabase.from('AppUser').update({isBlocked:!u.isBlocked}).eq('id',u.id).then(refreshData)}>{u.isBlocked?<ShieldCheck size={14}/>:<ShieldAlert size={14}/>}</button></td></tr>))}</tbody>
                    </table>
                 </div>
              )}
              {adminTab === 'rules' && (
                 <div className="bg-white p-6 rounded-xl border max-w-lg space-y-4">
                    <h3 className="font-bold border-b pb-2">全局规则配置</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-slate-500">默认最大时长(h)</label><input type="number" className="border p-2 w-full rounded" value={globalRules.maxDuration} onChange={e=>setGlobalRules({...globalRules,maxDuration:Number(e.target.value)})}/></div>
                        <div><label className="text-xs text-slate-500">最大提前天数</label><input type="number" className="border p-2 w-full rounded" value={globalRules.maxAdvanceDays} onChange={e=>setGlobalRules({...globalRules,maxAdvanceDays:Number(e.target.value)})}/></div>
                        <div><label className="text-xs text-slate-500">修改截至(h)</label><input type="number" className="border p-2 w-full rounded" value={globalRules.minCancelHours} onChange={e=>setGlobalRules({...globalRules,minCancelHours:Number(e.target.value)})}/></div>
                    </div>
                    <div className="flex gap-4"><label className="flex items-center gap-1"><input type="checkbox" checked={globalRules.weekendOpen} onChange={e=>setGlobalRules({...globalRules,weekendOpen:e.target.checked})}/> 周末开放</label><label className="flex items-center gap-1"><input type="checkbox" checked={globalRules.needAudit} onChange={e=>setGlobalRules({...globalRules,needAudit:e.target.checked})}/> 人工审核</label></div>
                    <button onClick={saveRules} className="btn-primary w-full py-2 rounded">保存全局规则</button>
                 </div>
              )}
           </div>
        )}
      </main>

      {/* 周视图大弹窗 */}
      {selectedEq && (
        <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50" style={HEADER_HEIGHT_STYLE}>
                 <div className="flex gap-2 items-center">
                    <button onClick={()=>setSelectedEq(null)} className="p-2 hover:bg-slate-200 rounded-full md:hidden"><ArrowLeft size={20}/></button>
                    <div><h3 className="text-xl font-bold">{selectedEq.name}</h3></div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border">
                       <button onClick={()=>setWeekStart(addDays(weekStart, -7))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                       <span className="text-sm font-medium w-32 text-center">{formatDate(weekStart)} ~ {formatDate(addDays(weekStart, 6))}</span>
                       <button onClick={()=>setWeekStart(addDays(weekStart, 7))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
                    </div>
                    <button onClick={()=>setSelectedEq(null)} className="p-2 hover:bg-slate-200 rounded-full hidden md:block"><X size={20}/></button>
                 </div>
              </div>

              {/* 顶部输入区 */}
              <div className="p-3 bg-white border-b flex flex-wrap gap-2 items-end justify-center shadow-sm z-20">
                 <div className="flex items-center gap-1 border p-1 rounded bg-slate-50">
                    <span className="text-xs text-slate-400">始</span>
                    <input type="date" className="bg-transparent text-sm w-28" value={bookingForm.startDate} onChange={e=>setBookingForm({...bookingForm, startDate:e.target.value})}/>
                    <input type="time" className="bg-transparent text-sm w-20" value={bookingForm.startTime} onChange={e=>setBookingForm({...bookingForm, startTime:e.target.value})}/>
                 </div>
                 <span className="text-slate-300 pb-2">➜</span>
                 <div className="flex items-center gap-1 border p-1 rounded bg-slate-50">
                    <span className="text-xs text-slate-400">终</span>
                    <input type="date" className="bg-transparent text-sm w-28" value={bookingForm.endDate} min={bookingForm.startDate} onChange={e=>setBookingForm({...bookingForm, endDate:e.target.value})}/>
                    <input type="time" className="bg-transparent text-sm w-20" value={bookingForm.endTime} onChange={e=>setBookingForm({...bookingForm, endTime:e.target.value})}/>
                 </div>
                 <input className="border p-1.5 rounded text-sm w-40" placeholder="备注..." value={bookingForm.note} onChange={e=>setBookingForm({...bookingForm, note:e.target.value})}/>
                 <button onClick={submitBooking} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 shadow">{bookingForm.id ? "保存" : "预约"}</button>
              </div>

              <div className="flex-1 overflow-auto relative flex bg-slate-50/50">
                 {/* 左侧刻度 (强制对齐) */}
                 <div className="w-12 flex-shrink-0 border-r bg-white sticky left-0 z-20 shadow text-[10px] text-slate-400">
                    <div style={HEADER_HEIGHT_STYLE}></div> {/* 占位头 */}
                    <div className="relative" style={{ height: `${GRID_HEIGHT}px` }}>
                       {[...Array(25)].map((_, i) => <div key={i} className="absolute w-full text-right pr-2 -mt-2" style={{ top: `${(i/24)*100}%` }}>{i}:00</div>)}
                    </div>
                 </div>
                 
                 {/* 七天网格 */}
                 <div className="flex-1 flex min-w-[800px]">
                    {[...Array(7)].map((_, dayIdx) => (
                        <div key={dayIdx} className="flex-1 border-r border-slate-200 min-w-[100px] flex flex-col bg-white">
                            <div className={`text-center py-2 text-sm border-b sticky top-0 bg-white z-10 shadow-sm ${new Date().toDateString() === addDays(weekStart, dayIdx).toDateString() ? 'bg-blue-50 text-blue-600 font-bold' : ''}`} style={HEADER_HEIGHT_STYLE}>
                               {['周日','周一','周二','周三','周四','周五','周六'][addDays(weekStart, dayIdx).getDay()]} <br/>
                               <span className="text-xs text-slate-400">{formatDate(addDays(weekStart, dayIdx)).slice(5)}</span>
                            </div>
                            <div className="flex-1 relative" style={{ height: `${GRID_HEIGHT}px` }}>{renderWeekCell(dayIdx)}</div>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 预约详情弹窗 (替代 alert) */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
           <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 space-y-4">
              <div className="flex justify-between items-start">
                 <h3 className="font-bold text-lg text-slate-800">预约详情</h3>
                 <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400"/></button>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                 <div className="flex gap-2"><User size={16} className="shrink-0 mt-0.5"/> <span><span className="font-medium text-slate-900">申请人:</span> {detailModal.user}</span></div>
                 <div className="flex gap-2"><Clock4 size={16} className="shrink-0 mt-0.5"/> <div><span className="font-medium text-slate-900">开始:</span> {formatDateTimeCN(detailModal.date, detailModal.startTime)}</div></div>
                 <div className="flex gap-2"><Clock4 size={16} className="shrink-0 mt-0.5"/> <div><span className="font-medium text-slate-900">结束:</span> {formatDateTimeCN(detailModal.endDate || detailModal.date, detailModal.endTime)}</div></div>
                 {detailModal.note && <div className="flex gap-2"><FileText size={16} className="shrink-0 mt-0.5"/> <div><span className="font-medium text-slate-900">备注:</span> {detailModal.note}</div></div>}
              </div>
              
              <div className="pt-4 border-t flex justify-end gap-2">
                 {(currentUser?.username === detailModal.user || userRole === 'admin') && (
                    <>
                      <button onClick={() => { setDetailModal(null); handleEditBooking(detailModal); }} className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 flex items-center gap-1"><Edit3 size={14}/> 修改</button>
                      <button onClick={() => { setDetailModal(null); handleCancelBooking(detailModal); }} className="px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-1"><Trash2 size={14}/> 撤销</button>
                    </>
                 )}
                 <button onClick={() => setDetailModal(null)} className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">关闭</button>
              </div>
           </div>
        </div>
      )}

      {/* 预约输入弹窗 (触发后打开) */}
      {modals.booking && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
             <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95">
                 <h3 className="font-bold text-lg">{bookingForm.id?"修改":"新建"}预约</h3>
                 <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-slate-500">开始</label><input type="date" className="border w-full p-1.5 rounded text-sm" value={bookingForm.startDate} onChange={e=>setBookingForm({...bookingForm,startDate:e.target.value})}/><input type="time" className="border w-full p-1.5 rounded text-sm mt-1" value={bookingForm.startTime} onChange={e=>setBookingForm({...bookingForm,startTime:e.target.value})}/></div>
                    <div><label className="text-xs text-slate-500">结束</label><input type="date" className="border w-full p-1.5 rounded text-sm" value={bookingForm.endDate} onChange={e=>setBookingForm({...bookingForm,endDate:e.target.value})}/><input type="time" className="border w-full p-1.5 rounded text-sm mt-1" value={bookingForm.endTime} onChange={e=>setBookingForm({...bookingForm,endTime:e.target.value})}/></div>
                 </div>
                 <textarea className="w-full border p-2 rounded h-20 text-sm" placeholder="备注..." value={bookingForm.note} onChange={e=>setBookingForm({...bookingForm,note:e.target.value})}/>
                 <div className="flex gap-2">
                    <button onClick={()=>setModals(p=>({...p,booking:false}))} className="flex-1 py-2 bg-slate-100 rounded text-slate-600">取消</button>
                    <button onClick={submitBooking} className="flex-1 py-2 bg-blue-600 text-white rounded">提交</button>
                 </div>
             </div>
         </div>
      )}

      {/* 其他小弹窗 */}
      {modals.limit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white p-6 rounded-xl w-80 space-y-4"><h3 className="font-bold">设置最大预约时长</h3><p className="text-sm text-slate-500">用户: {limitForm.username}</p><input type="number" className="border w-full p-2 rounded" placeholder="小时 (例如 24)" value={limitForm.hours} onChange={e=>setLimitForm({...limitForm, hours:e.target.value})}/><button onClick={handleLimitSave} className="w-full bg-blue-600 text-white py-2 rounded">保存</button><button onClick={()=>setModals({...modals,limit:false})} className="w-full text-slate-500 mt-2">取消</button></div></div>}
      {modals.eq && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><form onSubmit={handleSaveEquipment} className="bg-white p-6 rounded-xl w-80 space-y-3"><h3 className="font-bold">添加新设备</h3><div onClick={()=>fileInputRef.current.click()} className="h-32 bg-slate-100 rounded border-dashed border-2 flex items-center justify-center cursor-pointer">{previewImage||eqForm.imageUrl?<img src={previewImage||eqForm.imageUrl} className="h-full w-full object-cover"/>:<Camera className="text-slate-400"/>}</div><input type="file" hidden ref={fileInputRef} onChange={e=>{const f=e.target.files[0];if(f){setEqForm({...eqForm,image:f});setPreviewImage(URL.createObjectURL(f))}}}/><input placeholder="设备名称" className="border w-full p-2 rounded" value={eqForm.name} onChange={e=>setEqForm({...eqForm,name:e.target.value})} required/><input placeholder="位置" className="border w-full p-2 rounded" value={eqForm.location} onChange={e=>setEqForm({...eqForm,location:e.target.value})} required/><input placeholder="类型" className="border w-full p-2 rounded" value={eqForm.type} onChange={e=>setEqForm({...eqForm,type:e.target.value})} required/><button className="w-full bg-blue-600 text-white py-2 rounded">确认添加</button><button type="button" onClick={()=>setModals({...modals,eq:false})} className="w-full text-center text-slate-500 text-sm mt-2">取消</button></form></div>}
      {modals.pwd && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-xl w-80 space-y-3"><h3 className="font-bold">修改密码</h3><input type="password" placeholder="旧密码" className="border w-full p-2 rounded" value={pwdForm.oldPass} onChange={e=>setPwdForm({...pwdForm,oldPass:e.target.value})}/><input type="password" placeholder="新密码" className="border w-full p-2 rounded" value={pwdForm.newPass} onChange={e=>setPwdForm({...pwdForm,newPass:e.target.value})}/><input type="password" placeholder="确认新密码" className="border w-full p-2 rounded" value={pwdForm.confirmPass} onChange={e=>setPwdForm({...pwdForm,confirmPass:e.target.value})}/><button onClick={handleChangePassword} className="btn-primary w-full py-2 rounded">确认</button><button onClick={()=>setModals({...modals,pwd:false})} className="w-full text-center text-xs mt-2">取消</button></div></div>}
      {modals.user && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-xl w-80 space-y-3"><h3 className="font-bold">添加用户</h3><input placeholder="用户名" className="border p-2 w-full rounded" value={newUserForm.username} onChange={e=>setNewUserForm({...newUserForm,username:e.target.value})}/><input placeholder="密码" className="border p-2 w-full rounded" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm,password:e.target.value})}/><button onClick={handleAdminAddUser} className="btn-primary w-full py-2 rounded">添加</button><button onClick={()=>setModals({...modals,user:false})} className="w-full text-center text-xs mt-2">取消</button></div></div>}

      {notification && <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-white text-sm font-medium z-[100] animate-in slide-in-from-top-2 ${notification.type==='error'?'bg-red-500':'bg-slate-800'}`}>{notification.msg}</div>}
    </div>
  );
}
