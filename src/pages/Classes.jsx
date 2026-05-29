// Teacher/Coach classroom management
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { createClass, joinClassByCode, leaveClass, getMyClasses,
         watchClassMembers, regenerateJoinCode, deleteClass } from "../lib/firebase";
import { useToast } from "../components/Toast";
import { getLevelInfo } from "../data/gameData";

export default function Classes() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [tab,       setTab]       = useState("mine"); // mine | join | create | view
  const [teaching,  setTeaching]  = useState([]);
  const [student,   setStudent]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [openClass, setOpenClass] = useState(null);  // for the "view" mode
  const [members,   setMembers]   = useState([]);

  // Create form
  const [createForm, setCreateForm] = useState({ name:"", description:"", type:"general" });
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining]   = useState(false);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user]);

  async function refresh() {
    setLoading(true);
    const { teaching: t, student: s } = await getMyClasses(user.uid);
    setTeaching(t); setStudent(s); setLoading(false);
  }

  // Watch members for open class
  useEffect(() => {
    if (!openClass) return;
    const unsub = watchClassMembers(openClass.id, setMembers);
    return () => unsub();
  }, [openClass]);

  async function handleCreate() {
    if (!createForm.name.trim()) { toast("Class needs a name","warning"); return; }
    setCreating(true);
    try {
      const cls = await createClass(user.uid, user.displayName, createForm);
      toast(`"${cls.name}" created! Share code: ${cls.joinCode}`, "success", 6000);
      setCreateForm({ name:"", description:"", type:"general" });
      await refresh();
      setTab("mine");
    } catch(e) { toast("Create failed", "error"); console.error(e); }
    finally { setCreating(false); }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { toast("Enter a join code","warning"); return; }
    setJoining(true);
    try {
      const cls = await joinClassByCode(user.uid, user.displayName, user.photoURL, code);
      toast(`Joined "${cls.name}" by ${cls.teacherName}!`, "success");
      setJoinCode("");
      await refresh();
      setTab("mine");
    } catch(e) { toast(e.message || "Join failed", "error"); }
    finally { setJoining(false); }
  }

  async function handleLeave(cls) {
    if (!confirm(`Leave "${cls.name}"?`)) return;
    await leaveClass(user.uid, cls.id);
    toast(`Left "${cls.name}"`, "info");
    await refresh();
  }

  async function handleDelete(cls) {
    if (!confirm(`Delete "${cls.name}"? This can't be undone.`)) return;
    await deleteClass(cls.id, user.uid);
    toast(`Deleted "${cls.name}"`, "warning");
    setOpenClass(null);
    await refresh();
  }

  async function handleRegenCode(cls) {
    const newCode = await regenerateJoinCode(cls.id);
    toast(`New code: ${newCode}`, "success", 5000);
    await refresh();
    setOpenClass(c => c ? { ...c, joinCode: newCode } : null);
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    toast(`Code ${code} copied!`, "success", 2000);
  }

  // ── VIEW: single class detail ───────────────────────────────────────
  if (openClass) {
    const isTeacher = openClass.teacherUid === user.uid;
    return (
      <div className="page-content">
        <button className="btn-secondary" onClick={() => setOpenClass(null)} style={{ marginBottom:20 }}>← All classes</button>

        <div className="class-detail-header">
          <div style={{ flex:1 }}>
            <h1 className="page-title">{openClass.name}</h1>
            <p className="page-sub">{openClass.description || "No description"}</p>
            <div style={{ fontSize:13, color:"#888", marginTop:6 }}>
              Teacher: <strong>{openClass.teacherName}</strong> · {openClass.memberCount||0} member{openClass.memberCount===1?"":"s"}
            </div>
          </div>
          {isTeacher && (
            <div className="class-code-card">
              <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", letterSpacing:.5 }}>Join Code</div>
              <div className="class-code-big" onClick={() => copyCode(openClass.joinCode)}>{openClass.joinCode}</div>
              <div style={{ display:"flex", gap:6 }}>
                <button className="btn-secondary" onClick={() => copyCode(openClass.joinCode)} style={{ padding:"5px 12px", fontSize:12 }}>📋 Copy</button>
                <button className="btn-secondary" onClick={() => handleRegenCode(openClass)} style={{ padding:"5px 12px", fontSize:12 }}>🔄 New</button>
              </div>
            </div>
          )}
        </div>

        <h3 className="section-title" style={{ marginTop:24 }}>Roster ({members.length})</h3>
        <div className="member-list">
          {members.length===0 && <p style={{ color:"#666", padding:"20px 0" }}>No students yet. Share the join code to invite them.</p>}
          {members.map((m, i) => {
            const li = getLevelInfo(m.currentXP||0);
            const today = new Date().toISOString().split("T")[0];
            const checkedInToday = m.lastCheckIn === today;
            return (
              <div key={m.uid} className="member-row">
                <span className="member-rank">{i+1}</span>
                {m.photoURL
                  ? <img src={m.photoURL} className="friend-avatar" referrerPolicy="no-referrer" alt=""/>
                  : <div className="friend-avatar placeholder">{m.displayName?.[0]}</div>}
                <div style={{ flex:1 }}>
                  <div className="friend-name">{m.displayName}</div>
                  <div style={{ fontSize:12, color:li.current.color }}>{li.current.emoji} {li.current.title}</div>
                </div>
                <div className="member-stats">
                  <div><span style={{ color:"#FFD700", fontFamily:"'Bebas Neue',sans-serif", fontSize:22 }}>{m.currentXP||0}</span> <span style={{ fontSize:10, color:"#888" }}>XP</span></div>
                  <div><span style={{ color:"#FF4D4D" }}>🔥 {m.currentStreak||0}</span></div>
                  <div className={`checkin-pill ${checkedInToday?"done":""}`}>{checkedInToday?"✅ today":"⏳ waiting"}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:32, display:"flex", gap:8 }}>
          {isTeacher
            ? <button className="sbtn-danger" onClick={() => handleDelete(openClass)}>🗑 Delete Class</button>
            : <button className="sbtn-danger" onClick={() => { handleLeave(openClass); setOpenClass(null); }}>Leave Class</button>}
        </div>
      </div>
    );
  }

  // ── LIST + CREATE/JOIN ──────────────────────────────────────────────
  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🎓 Classes</h1><p className="page-sub">Coach a team. Join a class. Track progress together.</p></div>
      </div>

      <div className="tabs" style={{ marginBottom:20 }}>
        <button className={`tab-btn ${tab==="mine"?"active":""}`} onClick={()=>setTab("mine")}>📚 My Classes</button>
        <button className={`tab-btn ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>➕ Join</button>
        <button className={`tab-btn ${tab==="create"?"active":""}`} onClick={()=>setTab("create")}>🎓 Create (Teachers)</button>
      </div>

      {tab==="mine" && (
        <div>
          {loading && <div className="loading-card"><div className="spinner"/></div>}
          {!loading && teaching.length===0 && student.length===0 && (
            <div className="empty-state-card">
              <div style={{ fontSize:56 }}>🎓</div>
              <h3>No classes yet</h3>
              <p>Join with a code from your teacher, or create your own class if you coach a team.</p>
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button className="btn-primary" onClick={()=>setTab("join")} style={{ width:"auto", padding:"10px 24px" }}>Join a Class</button>
                <button className="btn-secondary" onClick={()=>setTab("create")}>Create Class</button>
              </div>
            </div>
          )}

          {teaching.length > 0 && (
            <>
              <h3 className="section-sub-title" style={{ marginBottom:12 }}>🎓 Classes you teach</h3>
              <div className="class-grid">
                {teaching.map(cls => <ClassCard key={cls.id} cls={cls} isTeacher onClick={() => setOpenClass(cls)}/>)}
              </div>
            </>
          )}

          {student.length > 0 && (
            <>
              <h3 className="section-sub-title" style={{ margin:"24px 0 12px" }}>📚 Classes you're in</h3>
              <div className="class-grid">
                {student.map(cls => <ClassCard key={cls.id} cls={cls} onClick={() => setOpenClass(cls)}/>)}
              </div>
            </>
          )}
        </div>
      )}

      {tab==="join" && (
        <div className="section-card" style={{ maxWidth:500 }}>
          <h3 className="section-title">Join a Class</h3>
          <p className="sform-sub">Your teacher will give you a 6-character code.</p>
          <label className="slabel">Class code</label>
          <input className="inp join-code-input" placeholder="e.g. K7P2QM"
            value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&handleJoin()} maxLength={6}/>
          <button className="btn-primary" onClick={handleJoin} disabled={joining||!joinCode.trim()}
            style={{ width:"auto", padding:"10px 28px", marginTop:14 }}>
            {joining?"Joining…":"Join Class"}
          </button>
        </div>
      )}

      {tab==="create" && (
        <div className="section-card" style={{ maxWidth:560 }}>
          <h3 className="section-title">Create a Class</h3>
          <p className="sform-sub">For teachers and coaches. Students will join with a code you share.</p>

          <label className="slabel">Class name</label>
          <input className="inp" placeholder="e.g. PE Period 3, Boys Varsity Track"
            value={createForm.name} onChange={e=>setCreateForm(f=>({...f,name:e.target.value}))}/>

          <label className="slabel" style={{ marginTop:12 }}>Description (optional)</label>
          <input className="inp" placeholder="What this class is about"
            value={createForm.description} onChange={e=>setCreateForm(f=>({...f,description:e.target.value}))}/>

          <label className="slabel" style={{ marginTop:12 }}>Class type</label>
          <select className="inp" value={createForm.type} onChange={e=>setCreateForm(f=>({...f,type:e.target.value}))}>
            <option value="general">General</option>
            <option value="gym">Gym / PE Class</option>
            <option value="sport">Sports Team</option>
            <option value="academic">Academic Class</option>
            <option value="club">Club / After School</option>
          </select>

          <button className="btn-primary" onClick={handleCreate} disabled={creating||!createForm.name.trim()}
            style={{ width:"auto", padding:"10px 28px", marginTop:16 }}>
            {creating ? "Creating…" : "🎓 Create Class"}
          </button>
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, isTeacher, onClick }) {
  const typeIcons = { gym:"🏋️", sport:"⚽", academic:"📚", club:"🎯", general:"📋" };
  return (
    <div className="class-card" onClick={onClick}>
      <div className="class-card-icon">{typeIcons[cls.type]||"📋"}</div>
      <div className="class-card-body">
        <div className="class-card-name">{cls.name}</div>
        <div className="class-card-desc">{cls.description || (isTeacher ? "—" : `Coach: ${cls.teacherName}`)}</div>
        <div className="class-card-stats">
          <span>👥 {cls.memberCount||0} member{cls.memberCount===1?"":"s"}</span>
          {isTeacher && <span style={{ fontFamily:"monospace", color:"#FFD700" }}>Code: {cls.joinCode}</span>}
        </div>
      </div>
      {isTeacher && <div className="class-card-badge">TEACHER</div>}
    </div>
  );
}
