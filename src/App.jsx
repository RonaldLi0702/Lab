import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Beaker, Clock, User, CheckCircle, XCircle, 
  Plus, Trash2, Search, Upload, Camera, Menu, X, Settings,
  LogOut, Calendar, Users, UserPlus,
  ShieldAlert, ShieldCheck, Ban, Key, ChevronUp, Clock4, Crown, FileText,
  MousePointerClick, Edit3, Filter, ArrowUpDown, LayoutGrid, ClipboardList, Eye
} from 'lucide-react';

// 🔴 请务必替换为您在 Supabase Settings -> API 获取的真实数据
const SUPABASE_URL = "https://rcmogvyepjhwexeojjuy.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbW9ndnllcGpod2V4ZW9qanV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzgwNjksImV4cCI6MjA4NDY1NDA2OX0.UIYJABF3-V3_po_xdfDhQK394_jEsxF6MPxBhsqLpZk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_RULES = {
  maxDuration: 4, 
  weekendOpen: true, 
  needAudit: false, 
  maxAdvanceDays: 7, 
  minCancelHours: 2  
};

const generateColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 85%)`; 
};

const minutesToTime = (m) => `${Math.floor(m/60).toString().padStart(2,'0')}:${Math.floor(m%60).toString().padStart(2,'0')}`;
const timeToMinutes = (s) => { const [h,m] = s.split(':').map(Number); return h*60+m; };

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
  
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({ status: 'all', equipmentId: 'all' });

  const [authMode, setAuthMode] = useState("login"); 
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [regForm, setRegForm] = useState({ username: "", password: "", confirmPass: "" });
  const [bookingForm, setBookingForm] = useState({ id: null, date: "", startTime: "", endTime: "", note: "" }); 
  const [eqForm, setEqForm] = useState({ name: "", type: "", location: "", status: "active", image: null });
  const [previewImage, setPreviewImage] = useState("");
  const [newUserForm, setNewUserForm] = useState({ username: "", password: "" });
  const [pwdForm, setPwdForm] = useState({ oldPass: "", newPass: "", confirmPass: "" });
  const [limitForm, setLimitForm] = useState({ userId: null, username: "", hours: "" });

  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, currentX: 0, startTimeMin: 0 });
  const timelineRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { refreshData(); }, [userRole]);

  const refreshData = async () => {
    setLoading(true);
    try {
      // 1. 获取全局规则
      const { data: rules } = await supabase.from('GlobalSettings').select('*');
      if (rules && rules.length > 0) {
        const ruleObj = rules[0];
        setGlobalRules({ ...DEFAULT_RULES, ...ruleObj });
        setRuleId(ruleObj.id);
        if (ruleObj.adminPassword) setAdminPassword(ruleObj.adminPassword);
      }

      if (userRole !== 'guest') {
        // 2. 获取设备列表
        const { data: eqs } = await supabase.from('Equipment').select('*').order('created_at', { ascending: false });
        if(eqs) setEquipmentList(eqs);

        // 3. 获取预约记录
        const { data: ress } = await supabase.from('Reservations').select('*').order('created_at', { ascending: false });
        if(ress) setReservations(ress);

        // 4. 获取用户列表 (仅管理员)
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

  const handleLogin = async () => {
    const { username, password } = loginForm;
    if (!username || !password) return showToast("请输入账号密码", "error");
    setLoading(true);
    try {
      if (username === 'admin' && password === adminPassword) {
        setUserRole('admin');
        setCurrentUser({ username: '超级管理员', role: 'admin', bookingLimit: null });
        showToast("欢迎回来，超级管理员");
      } else {
        const { data: users } = await supabase.from('AppUser').select('*').eq('username', username);
        if (users && users.length > 0 && users[0].password === password) {
            const u = users[0];
            setUserRole(u.role === 'admin' ? 'admin' : 'student');
            setCurrentUser({ username: u.username, id: u.id, role: u.role||'student', isBlocked: !!u.isBlocked, bookingLimit: u.bookingLimit });
            if (u.isBlocked) showToast("警告：账号被封禁", "error");
            else showToast(`欢迎, ${u.username}`);
        } else {
            showToast("账号或密码错误", "error");
        }
      }
    } catch (e) { showToast("登录出错", "error"); }
    setLoading(false);
  };

  const handleRegister = async () => {
    const { username, password, confirmPass } = regForm;
    if (!username || !password) return showToast("请填写完整", "error");
    if (password !== confirmPass) return showToast("密码不一致", "error");
    setLoading(true);
    try {
      const { data: existing } = await supabase.from('AppUser').select('*').eq('username', username);
      if (existing && existing.length > 0) return showToast("用户名已存在", "error");
      const { error } = await supabase.from('AppUser').insert([{ username, password, role: 'student' }]);
      if(error) throw error;
      showToast("注册成功"); setAuthMode('login'); setLoginForm({ username, password: '' });
    } catch (e) { showToast("注册失败", "error"); }
    setLoading(false);
  };

  const submitBooking = async () => {
    if (currentUser?.isBlocked) return showToast("账号被封禁", "error");
    const { id, date, startTime, endTime, note } = bookingForm;
    if (!date || !startTime || !endTime) return showToast("请完整填写时间", "error");

    const startT = new Date(`${date}T${startTime}`);
    const endT = new Date(`${date}T${endTime}`);
    const now = new Date();
    const duration = (endT - startT) / 36e5;

    if (endT <= startT) return showToast("时间无效", "error");
    if (startT < now) return showToast("不能预约过去的时间", "error");

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + globalRules.maxAdvanceDays);
    if (startT > maxDate) return showToast(`只能提前 ${globalRules.maxAdvanceDays} 天预约`, "error");

    let limit = currentUser?.bookingLimit || globalRules.maxDuration;
    if (duration > limit) return showToast(`最大预约时长为 ${limit} 小时`, "error");

    const isConflict = reservations.some(r => {
      if (id && r.id === id) return false;
      if (r.equipmentId !== selectedEq.id || r.status === 'rejected') return false;
      const rStart = new Date(`${r.date}T${r.startTime}`);
      const rEnd = new Date(`${r.date}T${r.endTime}`);
      return (startT < rEnd && endT > rStart);
    });
    if (isConflict) return showToast("该时段已被占用", "error");

    setLoading(true);
    try {
      const payload = { equipmentId: selectedEq.id, equipmentName: selectedEq.name, user: currentUser.username, date, startTime, endTime, note, status: (userRole === 'admin' || !globalRules.needAudit) ? 'approved' : 'pending' };
      if (id) await supabase.from('Reservations').update(payload).eq('id', id);
      else await supabase.from('Reservations').insert([payload]);
      await refreshData();
      setSelectedEq(null);
      showToast(id ? "修改成功" : "预约成功");
    } catch (e) { showToast("操作失败", "error"); }
    setLoading(false);
  };

  const handleMouseDown = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mins = Math.max(0, Math.min(1440, Math.floor((x / rect.width) * 1440)));
    setDragState({ isDragging: true, startX: x, currentX: x, startTimeMin: mins });
  };
  const handleMouseMove = (e) => {
    if (!dragState.isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    setDragState({ ...dragState, currentX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)) });
  };
  const handleMouseUp = (date) => {
    if (!dragState.isDragging) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const endMins = Math.max(0, Math.min(1440, Math.floor((dragState.currentX / rect.width) * 1440)));
    let [s, e] = [dragState.startTimeMin, endMins].sort((a,b)=>a-b);
    if (e - s >= 15) setBookingForm({ ...bookingForm, date, startTime: minutesToTime(s), endTime: minutesToTime(e) });
    setDragState({ isDragging: false, startX: 0, currentX: 0, startTimeMin: 0 });
  };

  const getFilteredReservations = (publicView) => {
    let data = [...reservations];
    if (publicView && userRole !== 'admin') {
       const now = new Date();
       data = data.filter(r => new Date(`${r.date}T${r.endTime}`) >= now);
    }
    if (filterConfig.status !== 'all') data = data.filter(r => r.status === filterConfig.status);
    if (filterConfig.equipmentId !== 'all') data = data.filter(r => r.equipmentId == filterConfig.equipmentId);
    
    return data.sort((a, b) => {
      let aV = sortConfig.key === 'date' ? new Date(`${a.date}T${a.startTime}`) : a[sortConfig.key]?.toString().toLowerCase();
      let bV = sortConfig.key === 'date' ? new Date(`${b.date}T${b.startTime}`) : b[sortConfig.key]?.toString().toLowerCase();
      if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSaveEquipment = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      let url = eqForm.imageUrl;
      if (eqForm.image instanceof File) {
        const name = `${Date.now()}_${eqForm.image.name}`;
        await supabase.storage.from('equipment-images').upload(name, eqForm.image);
        const { data } = supabase.storage.from('equipment-images').getPublicUrl(name);
        url = data.publicUrl;
      }
      const payload = { name: eqForm.name, type: eqForm.type, location: eqForm.location, status: eqForm.status, imageUrl: url || "https://placehold.co/400x300?text=Equipment" };
      if (eqForm.id) await supabase.from('Equipment').update(payload).eq('id', eqForm.id);
      else await supabase.from('Equipment').insert([payload]);
      await refreshData(); setModals({...modals, eq:false}); showToast("设备已保存");
    } catch (e) { showToast("保存失败", "error"); }
    setLoading(false);
  };

  const checkCanModify = (resDate, resStartTime) => {
      const startDateTime = new Date(`${resDate}T${resStartTime}`);
      const deadline = new Date(startDateTime.getTime() - globalRules.minCancelHours * 60 * 60 * 1000);
      return new Date() < deadline;
  };

  const handleCancelBooking = async (res) => {
      if (!checkCanModify(res.date, res.startTime) && userRole !== 'admin') return showToast(`距离开始不足 ${globalRules.minCancelHours} 小时，无法操作`, "error");
      if (!confirm("确定取消该预约吗？")) return;
      setLoading(true);
      try {
          await supabase.from('Reservations').delete().eq('id', res.id);
          await refreshData();
          showToast("预约已取消");
      } catch (e) { showToast("取消失败", "error"); }
      setLoading(false);
  };

  const handleEditBooking = (res) => {
      if (!checkCanModify(res.date, res.startTime) && userRole !== 'admin') return showToast(`距离开始不足 ${globalRules.minCancelHours} 小时，无法修改`, "error");
      const eq = equipmentList.find(e => e.id === res.equipmentId);
      if (!eq) return showToast("关联设备不存在", "error");
      setBookingForm({ id: res.id, date: res.date, startTime: res.startTime, endTime: res.endTime, note: res.note || "" });
      setSelectedEq(eq);
  };

  const handlePromoteUser = async (user) => {
    if (!confirm(`确定变更 "${user.username}" 的权限吗？`)) return;
    setLoading(true);
    await supabase.from('AppUser').update({ role: user.role === 'admin' ? 'student' : 'admin' }).eq('id', user.id);
    await refreshData(); setLoading(false); showToast("权限已变更");
  };

  const handleSaveUserLimit = async () => {
      setLoading(true);
      const limitVal = limitForm.hours ? parseFloat(limitForm.hours) : null;
      await supabase.from('AppUser').update({ bookingLimit: limitVal }).eq('id', limitForm.userId);
      await refreshData(); setModals({...modals, limit:false}); setLoading(false); showToast("设置已保存");
  };

  const handleAdminAddUser = async () => {
    setLoading(true);
    await supabase.from('AppUser').insert([{ username: newUserForm.username, password: newUserForm.password, role: 'student', isBlocked: false }]);
    await refreshData(); setModals({...modals, user:false}); setLoading(false); showToast("用户添加成功");
  };

  const saveRules = async () => {
    setLoading(true);
    const payload = { maxDuration: globalRules.maxDuration, weekendOpen: globalRules.weekendOpen, needAudit: globalRules.needAudit, maxAdvanceDays: globalRules.maxAdvanceDays, minCancelHours: globalRules.minCancelHours };
    if (ruleId) await supabase.from('GlobalSettings').update(payload).eq('id', ruleId);
    else await supabase.from('GlobalSettings').insert([payload]);
    setModals({...modals, rule:false}); setLoading(false); showToast("规则已更新");
  };

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

  if (userRole === 'guest') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-6 flex justify-center items-center gap-2">
          <Beaker className="text-blue-600"/> 实验室预约系统
        </h1>
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
           {['login','register'].map(m => (
             <button key={m} onClick={()=>setAuthMode(m)} className={`flex-1 py-2 rounded-md text-sm ${authMode===m?'bg-white shadow text-blue-600':'text-slate-500'}`}>
               {m==='login'?'登录':'注册'}
             </button>
           ))}
        </div>
        <div className="space-y-4">
           <input className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="用户名" value={authMode==='login'?loginForm.username:regForm.username} onChange={e=>authMode==='login'?setLoginForm({...loginForm,username:e.target.value}):setRegForm({...regForm,username:e.target.value})}/>
           <input type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="密码" value={authMode==='login'?loginForm.password:regForm.password} onChange={e=>authMode==='login'?setLoginForm({...loginForm,password:e.target.value}):setRegForm({...regForm,password:e.target.value})}/>
           {authMode==='register' && <input type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="确认密码" value={regForm.confirmPass} onChange={e=>setRegForm({...regForm,confirmPass:e.target.value})}/>}
           <button onClick={authMode==='login'?handleLogin:handleRegister} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">{authMode==='login'?'立即登录':'注册账号'}</button>
        </div>
      </div>
      {notification && <div className="fixed bottom-8 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg">{notification.msg}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-white border-b sticky top-0 z-20 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 font-bold text-lg"><Beaker className="text-blue-600"/> LabManager</div>
        <div className="hidden md:flex bg-slate-100 p-1 rounded-lg text-sm font-medium">
           {[
             {id:'dashboard', icon:LayoutGrid, label:'设备大厅'},
             {id:'public_schedule', icon:Eye, label:'预约公示'},
             {id:'my_bookings', icon:Clock4, label:'我的预约'},
             ...(userRole==='admin'?[{id:'admin_panel', icon:ClipboardList, label:'管理后台'}]:[])
           ].map(tab => (
             <button key={tab.id} onClick={()=>setMainView(tab.id)} className={`px-4 py-1.5 rounded-md flex items-center gap-1 ${mainView===tab.id?'bg-white shadow text-blue-700':'text-slate-500 hover:text-slate-700'}`}>
               <tab.icon size={16}/> {tab.label}
             </button>
           ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
             <span className="text-sm font-bold block">{currentUser?.username}</span>
             <span className="text-xs text-slate-500 bg-slate-100 px-1 rounded">{userRole==='admin'?'管理员':'用户'}</span>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={()=>setModals({...modals, pwd:true})} className="text-slate-400 hover:text-blue-600 p-1"><Key size={20}/></button>
              <button onClick={()=>{setUserRole('guest');setCurrentUser(null);setMainView('dashboard');}} className="text-slate-400 hover:text-red-600 p-1"><LogOut size={20}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg z-50 text-sm text-blue-600 flex items-center gap-2">处理中...</div>}

        {/* 视图: 设备大厅 */}
        {mainView === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">设备大厅</h2>
              {userRole==='admin' && (
                <div className="flex gap-2">
                  <button onClick={()=>setModals({...modals, rule:true})} className="btn-secondary flex gap-1 px-3 py-2 rounded"><Settings size={16}/> 规则</button>
                  <button onClick={()=>{setEqForm({name:"",type:"",location:"",status:"active",image:null});setPreviewImage("");setModals({...modals, eq:true})}} className="btn-primary flex gap-1 px-3 py-2 rounded"><Plus size={16}/> 添加</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equipmentList.map(item => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden group hover:shadow-md">
                  <div className="h-48 bg-slate-100 relative">
                    <img src={item.imageUrl} className="w-full h-full object-cover"/>
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-white/90 ${item.status==='active'?'text-green-600':'text-red-500'}`}>{item.status==='active'?'可预约':'维护中'}</div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{item.location} | {item.type}</p>
                    <button onClick={()=>{setBookingForm({id:null,date:new Date().toISOString().split('T')[0],startTime:"",endTime:"",note:""});setSelectedEq(item)}} disabled={item.status!=='active'} className={`w-full mt-4 py-2 rounded-lg font-medium ${item.status==='active'?'bg-slate-900 text-white hover:bg-slate-800':'bg-slate-100 text-slate-400'}`}>
                      {item.status==='active'?'立即预约':'暂停使用'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 视图: 预约公示 */}
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
                     {['equipmentName:设备','user:申请人','date:时间'].map(col => (
                       <th key={col} className="p-4 cursor-pointer hover:bg-slate-100" onClick={()=>setSortConfig({key:col.split(':')[0],direction:sortConfig.direction==='asc'?'desc':'asc'})}>
                          {col.split(':')[1]} <ArrowUpDown size={12} className="inline opacity-50"/>
                       </th>
                     ))}
                     <th className="p-4">状态</th>
                     {userRole==='admin' && <th className="p-4 text-right">操作</th>}
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {getFilteredReservations(true).map(res => (
                     <tr key={res.id} className="hover:bg-slate-50">
                       <td className="p-4 font-medium">{res.equipmentName}</td>
                       <td className="p-4">{res.user}</td>
                       <td className="p-4">
                         <div>{res.date} <span className="text-slate-400 ml-1">{res.startTime}-{res.endTime}</span></div>
                         {res.note && <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">📝 {res.note}</div>}
                       </td>
                       <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs border ${res.status==='approved'?'bg-green-50 text-green-600 border-green-200':res.status==='pending'?'bg-amber-50 text-amber-600 border-amber-200':'bg-red-50 text-red-600 border-red-200'}`}>{res.status}</span></td>
                       {userRole==='admin' && <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={()=>supabase.from('Reservations').update({status:'approved'}).eq('id',res.id).then(refreshData)} className="text-green-600"><CheckCircle size={18}/></button><button onClick={()=>supabase.from('Reservations').update({status:'rejected'}).eq('id',res.id).then(refreshData)} className="text-red-600"><XCircle size={18}/></button></div></td>}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {/* 视图: 我的预约 */}
        {mainView === 'my_bookings' && (
           <div className="grid gap-4">
             {reservations.filter(r => r.user === currentUser?.username && (userRole==='admin' || new Date(`${r.date}T${r.endTime}`)>=new Date())).map(res => (
               <div key={res.id} className="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg">{res.equipmentName} <span className="text-xs font-normal text-slate-500 border px-1 rounded ml-2">{res.status}</span></div>
                    <div className="text-sm text-slate-500 mt-1"><Calendar size={14} className="inline mr-1"/> {res.date} {res.startTime}-{res.endTime}</div>
                    {res.note && <div className="text-xs text-slate-400 mt-1">📝 {res.note}</div>}
                  </div>
                  {res.status!=='rejected' && (
                      <div className="flex gap-2">
                         <button onClick={()=>{const eq=equipmentList.find(e=>e.id===res.equipmentId);if(eq){setBookingForm({...res,id:res.id});setSelectedEq(eq)}}} className="btn-secondary text-xs px-3 py-1 rounded">修改</button>
                         <button onClick={()=>handleCancelBooking(res)} className="btn-danger text-xs px-3 py-1 rounded">取消</button>
                      </div>
                  )}
               </div>
             ))}
             {reservations.filter(r => r.user === currentUser?.username).length===0 && <div className="text-center text-slate-400 py-10">暂无预约</div>}
           </div>
        )}

        {/* 视图: 管理后台 */}
        {mainView === 'admin_panel' && userRole === 'admin' && (
           <div className="space-y-6">
             <div className="flex gap-4 border-b pb-2">
               {['equipments:设备管理','users:用户权限'].map(t => (
                 <button key={t} onClick={()=>setAdminTab(t.split(':')[0])} className={`pb-2 px-2 text-sm font-medium ${adminTab===t.split(':')[0]?'text-blue-600 border-b-2 border-blue-600':'text-slate-500'}`}>{t.split(':')[1]}</button>
               ))}
             </div>
             {adminTab === 'equipments' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="p-4 border-b flex justify-between"><h3 className="font-bold">用户列表</h3><button onClick={()=>setModals({...modals, user:true})} className="btn-primary text-xs px-3 py-1 rounded">添加</button></div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b"><tr><th className="p-3">用户</th><th className="p-3">角色</th><th className="p-3">状态</th><th className="p-3 text-right">操作</th></tr></thead>
                    <tbody className="divide-y">{userList.map(u=>(
                      <tr key={u.id}>
                        <td className="p-3">{u.username}</td>
                        <td className="p-3">{u.role==='admin'?'管理员':'用户'}</td>
                        <td className="p-3">{u.isBlocked?'封禁':'正常'}</td>
                        <td className="p-3 text-right flex justify-end gap-2">
                          <button onClick={()=>setLimitForm({userId:u.id,username:u.username,hours:u.bookingLimit||""})||setModals({...modals,limit:true})}><Clock4 size={16}/></button>
                          <button onClick={()=>handlePromoteUser(u)}><ChevronUp size={16}/></button>
                          <button onClick={()=>supabase.from('AppUser').update({isBlocked:!u.isBlocked}).eq('id',u.id).then(refreshData)}>{u.isBlocked?<ShieldCheck size={16}/>:<ShieldAlert size={16}/>}</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
               </div>
             )}
           </div>
        )}
      </main>

      {/* 弹窗：预约 */}
      {selectedEq && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">{bookingForm.id?"修改":"预约"}: {selectedEq.name}</h3><button onClick={()=>setSelectedEq(null)}><X className="text-slate-400"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input type="date" className="input-field w-full border p-2 rounded" value={bookingForm.date} onChange={e=>setBookingForm({...bookingForm, date:e.target.value, startTime:"", endTime:""})}/>
              <div className="relative h-16 bg-slate-100 rounded border cursor-crosshair overflow-hidden" ref={timelineRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={()=>handleMouseUp(bookingForm.date)} onMouseLeave={()=>handleMouseUp(bookingForm.date)}>
                 {[...Array(25)].map((_,i)=><div key={i} className="absolute top-0 bottom-0 border-l border-slate-300 pointer-events-none" style={{left:`${(i/24)*100}%`}}/>)}
                 {reservations.filter(r=>r.equipmentId===selectedEq.id && r.date===bookingForm.date && r.status!=='rejected' && r.id!==bookingForm.id).map(r=>(
                    <div key={r.id} className="absolute top-1 bottom-1 rounded opacity-80" style={{left:`${(timeToMinutes(r.startTime)/1440)*100}%`,width:`${((timeToMinutes(r.endTime)-timeToMinutes(r.startTime))/1440)*100}%`,backgroundColor:generateColor(r.user)}} title={`${r.startTime}-${r.endTime}`}/>
                 ))}
                 {dragState.isDragging && <div className="absolute top-0 bottom-0 bg-blue-500/30 border-x border-blue-600 pointer-events-none" style={{left:`${Math.min(dragState.startX,dragState.currentX)}px`,width:`${Math.abs(dragState.currentX-dragState.startX)}px`}}/>}
              </div>
              <div className="flex gap-2"><input type="time" className="border p-2 rounded w-full" value={bookingForm.startTime} onChange={e=>setBookingForm({...bookingForm,startTime:e.target.value})}/><input type="time" className="border p-2 rounded w-full" value={bookingForm.endTime} onChange={e=>setBookingForm({...bookingForm,endTime:e.target.value})}/></div>
              <textarea className="w-full border p-2 rounded h-20 text-sm" placeholder="备注..." value={bookingForm.note} onChange={e=>setBookingForm({...bookingForm,note:e.target.value})}/>
              <button onClick={submitBooking} className="w-full btn-primary py-3 rounded">{bookingForm.id?"保存":"提交"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗：其他 (简化展示) */}
      {modals.eq && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <form onSubmit={handleSaveEquipment} className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4">
              <h3 className="font-bold">添加设备</h3>
              <div onClick={()=>fileInputRef.current.click()} className="h-32 bg-slate-100 rounded border-dashed border-2 flex items-center justify-center cursor-pointer">{previewImage||eqForm.imageUrl?<img src={previewImage||eqForm.imageUrl} className="h-full w-full object-cover"/>:<Camera className="text-slate-400"/>}</div>
              <input type="file" hidden ref={fileInputRef} onChange={e=>{const f=e.target.files[0];if(f){setEqForm({...eqForm,image:f});setPreviewImage(URL.createObjectURL(f))}}}/><input placeholder="名称" className="border p-2 rounded w-full" value={eqForm.name} onChange={e=>setEqForm({...eqForm,name:e.target.value})} required/><div className="flex gap-2"><input placeholder="位置" className="border p-2 rounded w-full" value={eqForm.location} onChange={e=>setEqForm({...eqForm,location:e.target.value})} required/><input placeholder="类型" className="border p-2 rounded w-full" value={eqForm.type} onChange={e=>setEqForm({...eqForm,type:e.target.value})} required/></div><button className="btn-primary w-full py-2 rounded">保存</button><button type="button" onClick={()=>setModals({...modals,eq:false})} className="w-full text-slate-500 text-xs text-center mt-2">取消</button>
           </form>
        </div>
      )}
      
      {modals.pwd && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-3"><h3 className="font-bold">修改密码</h3><input type="password" placeholder="旧密码" className="border p-2 w-full rounded" value={pwdForm.oldPass} onChange={e=>setPwdForm({...pwdForm,oldPass:e.target.value})}/><input type="password" placeholder="新密码" className="border p-2 w-full rounded" value={pwdForm.newPass} onChange={e=>setPwdForm({...pwdForm,newPass:e.target.value})}/><input type="password" placeholder="确认新密码" className="border p-2 w-full rounded" value={pwdForm.confirmPass} onChange={e=>setPwdForm({...pwdForm,confirmPass:e.target.value})}/><button onClick={handleChangePassword} className="btn-primary w-full py-2 rounded">确认</button><button onClick={()=>setModals({...modals,pwd:false})} className="w-full text-slate-500 text-xs text-center mt-2">取消</button></div></div>}
      
      {modals.user && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-3"><h3 className="font-bold">添加用户</h3><input placeholder="用户名" className="border p-2 w-full rounded" value={newUserForm.username} onChange={e=>setNewUserForm({...newUserForm,username:e.target.value})}/><input placeholder="密码" className="border p-2 w-full rounded" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm,password:e.target.value})}/><button onClick={handleAdminAddUser} className="btn-primary w-full py-2 rounded">添加</button><button onClick={()=>setModals({...modals,user:false})} className="w-full text-slate-500 text-xs text-center mt-2">取消</button></div></div>}
      
      {modals.limit && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-3"><h3 className="font-bold">设置限制: {limitForm.username}</h3><input type="number" placeholder="最大时长(h)" className="border p-2 w-full rounded" value={limitForm.hours} onChange={e=>setLimitForm({...limitForm,hours:e.target.value})}/><button onClick={handleSaveUserLimit} className="btn-primary w-full py-2 rounded">保存</button><button onClick={()=>setModals({...modals,limit:false})} className="w-full text-slate-500 text-xs text-center mt-2">取消</button></div></div>}

      {/* 规则设置弹窗 */}
      {modals.rule && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4">
              <h3 className="font-bold">规则设置</h3>
              <div><label className="text-xs text-slate-500">默认最大时长(h)</label><input type="number" className="border p-2 w-full rounded" value={globalRules.maxDuration} onChange={e=>setGlobalRules({...globalRules,maxDuration:Number(e.target.value)})}/></div>
              <div><label className="text-xs text-slate-500">最大提前天数</label><input type="number" className="border p-2 w-full rounded" value={globalRules.maxAdvanceDays} onChange={e=>setGlobalRules({...globalRules,maxAdvanceDays:Number(e.target.value)})}/></div>
              <div><label className="text-xs text-slate-500">修改截至(h)</label><input type="number" className="border p-2 w-full rounded" value={globalRules.minCancelHours} onChange={e=>setGlobalRules({...globalRules,minCancelHours:Number(e.target.value)})}/></div>
              <div className="flex justify-between items-center"><span className="text-sm">周末开放</span><input type="checkbox" checked={globalRules.weekendOpen} onChange={e=>setGlobalRules({...globalRules,weekendOpen:e.target.checked})}/></div>
              <div className="flex justify-between items-center"><span className="text-sm">人工审核</span><input type="checkbox" checked={globalRules.needAudit} onChange={e=>setGlobalRules({...globalRules,needAudit:e.target.checked})}/></div>
              <button onClick={saveRules} className="btn-primary w-full py-2 rounded">保存</button>
              <button onClick={()=>setModals({...modals,rule:false})} className="text-xs text-center w-full mt-2 text-slate-500">关闭</button>
           </div>
        </div>
      )}

      {notification && <div className={`fixed bottom-8 right-8 px-4 py-3 rounded-lg shadow-lg text-white text-sm z-50 ${notification.type==='error'?'bg-red-500':'bg-slate-800'}`}>{notification.msg}</div>}
    </div>
  );
}
