import { useState, useEffect, useRef } from "react";
import {
  Users, Plus, Inbox, Swords, Shield, X, Copy, Download, Camera,
  Zap, Flame, CheckSquare, Hourglass, Crown,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { sendFriendRequest, acceptFriendRequest, declineFriendRequest,
         watchIncomingRequests, getFriendsProfiles, getUserProfile,
         sendChallenge, watchMyChallenges, acceptChallenge, declineChallenge, resolveChallenge,
         createGuild, watchMyGuild, findGuildByName, sendGuildInvite, watchGuildInvites,
         acceptGuildInvite, declineGuildInvite, leaveGuild, kickGuildMember,
         sendGuildChallenge, watchMyGuildChallenges, acceptGuildChallenge,
         declineGuildChallenge, resolveGuildChallenge } from "../lib/firebase";
import { getLevelInfo } from "../data/gameData";
import { useToast } from "../components/Toast";
import QRCode from "qrcode";
import { BrowserQRCodeReader } from "@zxing/library";

function QRDisplay({ uid, displayName }) {
  const canvasRef = useRef();
  const [copied, setCopied] = useState(false);
  const addUrl = `${window.location.origin}${window.location.pathname}?addFriend=${uid}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, addUrl, { width:200, margin:2, color:{ dark:"#FF3131", light:"#111111" }});
  }, [uid]);

  return (
    <div className="qr-display">
      <canvas ref={canvasRef} className="qr-canvas"/>
      <div className="qr-name">{displayName}</div>
      <div className="qr-url">{addUrl.replace(window.location.origin,"")}</div>
      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(addUrl); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
          style={{ width:"auto", padding:"8px 20px", fontSize:14, display:"inline-flex", alignItems:"center", gap:6 }}>
          {copied ? <><CheckSquare size={14}/> Copied!</> : <><Copy size={14}/> Copy Link</>}
        </button>
        <button className="btn-secondary" onClick={() => { const l=document.createElement("a"); l.download=`grind-qr-${displayName}.png`; l.href=canvasRef.current.toDataURL(); l.click(); }}
          style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
          <Download size={14}/> Save QR
        </button>
      </div>
    </div>
  );
}

function FriendCard({ friend, onChallenge }) {
  const li = getLevelInfo(friend.xp||0);
  const checkedInToday = friend.lastCheckIn === new Date().toISOString().split("T")[0];
  return (
    <div className="friend-card">
      {(friend.customPhotoURL||friend.photoURL)
        ? <img src={friend.customPhotoURL||friend.photoURL} className="friend-avatar" referrerPolicy="no-referrer" alt=""/>
        : <div className="friend-avatar placeholder">{friend.displayName?.[0]}</div>}
      <div className="friend-info">
        <div className="friend-name">{friend.displayName}</div>
        <div style={{ fontSize:12, color:li.current.color }}>{li.current.emoji} {li.current.title}</div>
        <div style={{ display:"flex", gap:10, fontSize:12, color:"#888", marginTop:3, flexWrap:"wrap" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><Zap size={12}/> {friend.xp||0} XP</span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><Flame size={12}/> {friend.streak||0} streak</span>
          <span className={`checkin-pill ${checkedInToday?"done":""}`} style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
            {checkedInToday ? <><CheckSquare size={12}/> checked in</> : <><Hourglass size={12}/> not yet</>}
          </span>
        </div>
      </div>
      <button className="challenge-btn" onClick={() => onChallenge(friend)} title="Challenge to 7-day XP race"><Swords size={16}/></button>
    </div>
  );
}

export default function Friends() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [tab,       setTab]       = useState("friends");
  const [friends,   setFriends]   = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [challenges,setChallenges]= useState([]);
  const [scanUID,   setScanUID]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const videoRef   = useRef();
  const readerRef  = useRef(null);

  // Real-time friend requests
  useEffect(() => {
    if (!user) return;
    const unsub = watchIncomingRequests(user.uid, setRequests);
    return () => unsub();
  }, [user]);

  // Real-time challenges
  useEffect(() => {
    if (!user) return;
    const unsub = watchMyChallenges(user.uid, async list => {
      // Auto-resolve any active challenge past its end date
      const today = new Date().toISOString().split("T")[0];
      for (const c of list) {
        if (c.status==="active" && c.endsAt < today) {
          await resolveChallenge(c.id);
        }
      }
      setChallenges(list);
    });
    return () => unsub();
  }, [user]);

  // Load friend profiles
  useEffect(() => {
    if (!profile) return;
    getFriendsProfiles(profile.friends || []).then(fps => { setFriends(fps.filter(Boolean)); setLoading(false); });
  }, [profile]);

  // Handle ?addFriend= from QR/link
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const addUID = params.get("addFriend");
    if (addUID && addUID !== user.uid) {
      setScanUID(addUID); setTab("add");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  async function handleAdd() {
    if (!scanUID.trim()) { toast("Enter a user ID or paste a link","warning"); return; }
    let uid = scanUID.trim();
    if (uid.includes("addFriend=")) { try { uid = new URL(uid).searchParams.get("addFriend"); } catch {} }
    if (uid === user.uid) { toast("That's you 😄","warning"); return; }
    if ((profile?.friends||[]).includes(uid)) { toast("Already friends!","info"); return; }
    setAdding(true);
    try {
      const theirProfile = await getUserProfile(uid);
      if (!theirProfile) { toast("User not found","error"); return; }
      await sendFriendRequest(user.uid, uid);
      toast(`Friend request sent to ${theirProfile.displayName}! 🤝`, "success");
      setScanUID("");
    } catch(e) { toast(e.message||"Failed to send request","error"); }
    finally { setAdding(false); }
  }

  async function handleAccept(req) {
    await acceptFriendRequest(req.id, user.uid, req.from);
    await refreshProfile();
    toast("Friend added! 🎉","success");
  }

  async function handleDecline(req) {
    await declineFriendRequest(req.id);
    toast("Request declined","info");
  }

  async function challengeFriend(friend) {
    try {
      await sendChallenge(user.uid, user.displayName, friend.uid, friend.displayName, "7-day XP race", 7);
      toast(`Challenge sent to ${friend.displayName}! ⚔️`, "success");
      setTab("challenges");
    } catch(e) { toast("Failed to send challenge","error"); }
  }

  // ── ZXing cross-browser QR scanning ──
  async function startScan() {
    setScanning(true);
    try {
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      await reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          const url = result.getText();
          stopScan();
          if (url.includes("addFriend=")) {
            try {
              const uid = new URL(url).searchParams.get("addFriend");
              setScanUID(uid);
              toast("QR scanned! Hit Add to send request","success");
            } catch { setScanUID(url); }
          } else {
            setScanUID(url);
            toast("Scanned — hit Add","info");
          }
        }
      });
    } catch(e) {
      toast("Camera access denied or unavailable","error");
      setScanning(false);
    }
  }

  function stopScan() {
    if (readerRef.current) { readerRef.current.reset(); readerRef.current = null; }
    setScanning(false);
  }

  useEffect(() => () => stopScan(), []); // cleanup on unmount

  const activeChallenges = challenges.filter(c => c.status==="active" || c.status==="pending");
  const pastChallenges   = challenges.filter(c => c.status==="completed" || c.status==="declined");

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title"><Users size={28}/> Friends</h1><p className="page-sub">Add friends via QR. Track streaks. Battle for XP.</p></div>
        {(requests.length>0 || activeChallenges.length>0) && (
          <div style={{ display:"flex", gap:8 }}>
            {requests.length>0 && <div className="req-badge">{requests.length} request{requests.length>1?"s":""}</div>}
            {activeChallenges.length>0 && <div className="req-badge" style={{ borderColor:"#B84DFF", color:"#B84DFF", background:"#15001a", display:"inline-flex", alignItems:"center", gap:4 }}>{activeChallenges.length} <Swords size={12}/></div>}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom:20 }}>
        {[["friends",Users,"Friends"],["add",Plus,"Add"],["requests",Inbox,"Requests"],["challenges",Swords,"Challenges"],["guild",Shield,"Guild"]].map(([id,Icon,label]) => (
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={() => setTab(id)}
            style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <Icon size={14}/>{label}
            {id==="requests"   && requests.length>0        ? ` (${requests.length})` : ""}
            {id==="challenges" && activeChallenges.length>0 ? ` (${activeChallenges.length})` : ""}
          </button>
        ))}
      </div>

      {/* FRIENDS */}
      {tab==="friends" && (
        <div>
          {loading && <div className="loading-card"><div className="spinner"/></div>}
          {!loading && friends.length===0 && (
            <div className="empty-state-card">
              <Users size={56}/><h3>No friends yet</h3>
              <p>Add friends with QR code or share your link.</p>
              <button className="btn-primary" onClick={()=>setTab("add")} style={{ width:"auto", padding:"10px 24px", marginTop:8 }}>Add a Friend</button>
            </div>
          )}
          <div className="friends-list">
            {friends.map(f => f && <FriendCard key={f.uid} friend={f} onChallenge={challengeFriend}/>)}
          </div>
        </div>
      )}

      {/* ADD */}
      {tab==="add" && (
        <div className="add-friend-layout">
          <div className="qr-section">
            <h3 className="section-sub-title">Your QR Code</h3>
            <p style={{ fontSize:13, color:"#888", marginBottom:16 }}>Let others scan this to add you</p>
            <QRDisplay uid={user.uid} displayName={user.displayName}/>
          </div>
          <div className="add-friend-right">
            <h3 className="section-sub-title">Scan a Friend's QR</h3>
            <div className="camera-box">
              <video ref={videoRef} className={`qr-video ${scanning?"active":""}`} muted playsInline/>
              {!scanning && <div className="camera-placeholder"><Camera size={48}/></div>}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {!scanning
                ? <button className="btn-primary" onClick={startScan} style={{ width:"auto", padding:"10px 24px", display:"inline-flex", alignItems:"center", gap:6 }}><Camera size={14}/> Start Scan</button>
                : <button className="btn-secondary" onClick={stopScan}>Stop</button>}
            </div>
            <div className="divider-or"><span>or paste link / UID</span></div>
            <div style={{ display:"flex", gap:8, marginTop:16 }}>
              <input className="inp" placeholder="User ID or grind link" value={scanUID}
                onChange={e=>setScanUID(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
              <button className="btn-primary" onClick={handleAdd} disabled={adding||!scanUID.trim()} style={{ width:"auto", padding:"10px 20px", flexShrink:0 }}>
                {adding?"Adding…":"Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUESTS */}
      {tab==="requests" && (
        <div>
          {requests.length===0 && <div className="empty-state-card"><p style={{ color:"#555" }}>No pending friend requests.</p></div>}
          {requests.map(req => <RequestCard key={req.id} req={req} onAccept={()=>handleAccept(req)} onDecline={()=>handleDecline(req)}/>)}
        </div>
      )}

      {/* CHALLENGES */}
      {tab==="challenges" && (
        <div>
          {challenges.length===0 && (
            <div className="empty-state-card">
              <Swords size={48}/>
              <p style={{ color:"#888" }}>No challenges yet. Challenge a friend to a 7-day XP race!</p>
            </div>
          )}
          {activeChallenges.length>0 && <h3 className="section-sub-title" style={{ marginBottom:12 }}>Active</h3>}
          {activeChallenges.map(c => <ChallengeCard key={c.id} c={c} uid={user.uid} onAccept={()=>acceptChallenge(c.id)} onDecline={()=>declineChallenge(c.id)}/>)}
          {pastChallenges.length>0 && <h3 className="section-sub-title" style={{ margin:"24px 0 12px" }}>History</h3>}
          {pastChallenges.map(c => <ChallengeCard key={c.id} c={c} uid={user.uid} past/>)}
        </div>
      )}

      {/* GUILD */}
      {tab==="guild" && <GuildSection user={user} friends={friends} toast={toast} />}
    </div>
  );
}

function RequestCard({ req, onAccept, onDecline }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => { getUserProfile(req.from).then(setProfile); }, [req.from]);
  if (!profile) return null;
  const li = getLevelInfo(profile.xp||0);
  return (
    <div className="friend-card" style={{ marginBottom:10 }}>
      {(profile.customPhotoURL||profile.photoURL)
        ? <img src={profile.customPhotoURL||profile.photoURL} className="friend-avatar" referrerPolicy="no-referrer" alt=""/>
        : <div className="friend-avatar placeholder">{profile.displayName?.[0]}</div>}
      <div className="friend-info">
        <div className="friend-name">{profile.displayName}</div>
        <div style={{ fontSize:12, color:li.current.color }}>{li.current.emoji} {li.current.title}</div>
        <div style={{ fontSize:12, color:"#888", display:"flex", alignItems:"center", gap:4 }}>
          <Zap size={12}/> {profile.xp||0} XP · <Flame size={12}/> {profile.streak||0} streak
        </div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-primary" onClick={onAccept} style={{ width:"auto", padding:"7px 16px", fontSize:13 }}>Accept</button>
        <button className="btn-secondary" onClick={onDecline} style={{ padding:"7px 16px" }}>Decline</button>
      </div>
    </div>
  );
}

// ── Guilds / Squads — N-person team challenges ──────────────────────────────
const GUILD_EMOJIS = ["🛡️","⚔️","🐉","🦁","🐺","🔥","⚡","🌊","🏔️","💀","👑","🚀"];

function GuildSection({ user, friends, toast }) {
  const [guild,        setGuild]        = useState(undefined); // undefined = loading, null = none
  const [invites,      setInvites]      = useState([]);
  const [gChallenges,  setGChallenges]  = useState([]);
  const [creating,     setCreating]     = useState(false);
  const [name,         setName]         = useState("");
  const [emoji,        setEmoji]        = useState(GUILD_EMOJIS[0]);
  const [targetName,   setTargetName]   = useState("");
  const [challenging,  setChallenging]  = useState(false);
  const [inviteFriend, setInviteFriend] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = watchMyGuild(user.uid, setGuild);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchGuildInvites(user.uid, setInvites);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!guild?.id) { setGChallenges([]); return; }
    const unsub = watchMyGuildChallenges(guild.id, async list => {
      const today = new Date().toISOString().split("T")[0];
      for (const c of list) {
        if (c.status === "active" && c.endsAt < today) await resolveGuildChallenge(c.id);
      }
      setGChallenges(list);
    });
    return () => unsub();
  }, [guild?.id]);

  async function handleCreate() {
    const v = name.trim();
    if (!v) { toast("Enter a guild name", "warning"); return; }
    setCreating(true);
    try {
      await createGuild(user.uid, user.displayName, v, emoji);
      toast(`Guild "${v}" founded! 🛡️`, "success");
      setName("");
    } catch (e) { toast("Failed to create guild", "error"); }
    finally { setCreating(false); }
  }

  async function handleInvite() {
    if (!inviteFriend) return;
    const friend = friends.find(f => f.uid === inviteFriend);
    if (!friend) return;
    try {
      await sendGuildInvite(guild.id, guild.name, guild.emoji, user.uid, user.displayName, friend.uid, friend.displayName);
      toast(`Invite sent to ${friend.displayName}!`, "success");
      setInviteFriend("");
    } catch (e) { toast("Failed to send invite", "error"); }
  }

  async function handleAcceptInvite(inv) {
    try { await acceptGuildInvite(inv); toast(`Joined ${inv.guildName}! 🛡️`, "success"); }
    catch (e) { toast("Failed to join — you may already be in a guild", "error"); }
  }

  async function handleChallenge() {
    const v = targetName.trim();
    if (!v) { toast("Enter the rival guild's name", "warning"); return; }
    setChallenging(true);
    try {
      const target = await findGuildByName(v);
      if (!target) { toast("No guild found with that exact name", "error"); return; }
      if (target.id === guild.id) { toast("That's your own guild 😄", "warning"); return; }
      await sendGuildChallenge(guild, target, user.uid, user.displayName, 7);
      toast(`Challenge sent to ${target.name}! ⚔️`, "success");
      setTargetName("");
    } catch (e) { toast("Failed to send challenge", "error"); }
    finally { setChallenging(false); }
  }

  if (guild === undefined) return <div className="loading-card"><div className="spinner"/></div>;

  const isOwner = guild?.ownerUid === user.uid;
  const inviteCandidates = friends.filter(f => !(guild?.members || []).includes(f.uid));
  const activeGC = gChallenges.filter(c => c.status === "active" || c.status === "pending");
  const pastGC   = gChallenges.filter(c => c.status === "completed" || c.status === "declined");

  // ── Not in a guild yet ──
  if (!guild) {
    return (
      <div>
        {invites.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 className="section-sub-title" style={{ marginBottom:12 }}>Guild Invites</h3>
            {invites.map(inv => (
              <div key={inv.id} className="friend-card" style={{ marginBottom:10 }}>
                <div className="friend-avatar placeholder">{inv.guildEmoji}</div>
                <div className="friend-info">
                  <div className="friend-name">{inv.guildName}</div>
                  <div style={{ fontSize:12, color:"#888" }}>Invited by {inv.fromName}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-primary" onClick={() => handleAcceptInvite(inv)} style={{ width:"auto", padding:"7px 16px", fontSize:13 }}>Join</button>
                  <button className="btn-secondary" onClick={() => declineGuildInvite(inv.id)} style={{ padding:"7px 16px" }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="empty-state-card">
          <Shield size={48}/>
          <h3>No guild yet</h3>
          <p style={{ color:"#888", marginBottom:16 }}>
            Found a guild and recruit your friends — squads compete together for XP glory,
            instead of going it alone in 1-on-1 challenges.
          </p>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:14 }}>
            {GUILD_EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                style={{ fontSize:20, padding:"6px 10px", borderRadius:8, cursor:"pointer",
                  border:`2px solid ${emoji===e ? "var(--accent)" : "var(--border2)"}`,
                  background: emoji===e ? "var(--bg4)" : "var(--bg3)" }}>
                {e}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", maxWidth:400, margin:"0 auto", flexWrap:"wrap" }}>
            <input className="inp" placeholder="Guild name (e.g. The Grindset)" value={name}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter" && handleCreate()} maxLength={30}/>
            <button className="btn-primary" onClick={handleCreate} disabled={creating || !name.trim()} style={{ width:"auto", padding:"10px 20px", flexShrink:0 }}>
              {creating ? "Founding…" : "Found Guild"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── In a guild ──
  return (
    <div>
      <div className="card" style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20, padding:20 }}>
        <div style={{ fontSize:40 }}>{guild.emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:800 }}>{guild.name}</div>
          <div style={{ fontSize:12, color:"#888" }}>
            {(guild.members || []).length} member{(guild.members || []).length !== 1 ? "s" : ""}
            {isOwner && <> · <Crown size={12} style={{ verticalAlign:"-2px" }}/> You lead this guild</>}
          </div>
        </div>
        <button className="btn-secondary" onClick={async () => {
          if (confirm(`Leave ${guild.name}?`)) { await leaveGuild(guild.id, user.uid); toast("You left the guild", "info"); }
        }}>
          Leave
        </button>
      </div>

      {/* Roster */}
      <h3 className="section-sub-title" style={{ marginBottom:12 }}>Roster</h3>
      <div className="friends-list" style={{ marginBottom:24 }}>
        {(guild.members || []).map(uid => (
          <GuildMemberRow key={uid} uid={uid} name={guild.memberNames?.[uid]} isOwner={isOwner}
            guildId={guild.id} ownerUid={guild.ownerUid} me={user.uid} toast={toast}/>
        ))}
      </div>

      {/* Recruit */}
      {isOwner && inviteCandidates.length > 0 && (
        <div className="card" style={{ padding:16, marginBottom:24 }}>
          <label className="mp-label">Recruit a friend</label>
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
            <select className="inp" value={inviteFriend} onChange={e => setInviteFriend(e.target.value)}>
              <option value="">Choose a friend…</option>
              {inviteCandidates.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
            </select>
            <button className="btn-primary" onClick={handleInvite} disabled={!inviteFriend} style={{ width:"auto", padding:"10px 20px", flexShrink:0 }}>
              Invite
            </button>
          </div>
        </div>
      )}

      {/* Challenge another guild */}
      {isOwner && (
        <div className="card" style={{ padding:16, marginBottom:24 }}>
          <label className="mp-label" style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Swords size={14}/> Challenge a rival guild — 7-day combined-XP race</label>
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
            <input className="inp" placeholder="Exact rival guild name…" value={targetName}
              onChange={e => setTargetName(e.target.value)} onKeyDown={e => e.key==="Enter" && handleChallenge()}/>
            <button className="btn-primary" onClick={handleChallenge} disabled={challenging || !targetName.trim()} style={{ width:"auto", padding:"10px 20px", flexShrink:0 }}>
              {challenging ? "Sending…" : "Challenge"}
            </button>
          </div>
        </div>
      )}

      {/* Guild challenges */}
      <h3 className="section-sub-title" style={{ marginBottom:12 }}>Guild Challenges</h3>
      {gChallenges.length === 0 && (
        <div className="empty-state-card"><p style={{ color:"#555" }}>
          No squad challenges yet. Find a rival guild's exact name and challenge them to a combined-XP race!
        </p></div>
      )}
      {activeGC.map(c => (
        <GuildChallengeCard key={c.id} c={c} guildId={guild.id} isOwner={isOwner}
          onAccept={() => acceptGuildChallenge(c.id)} onDecline={() => declineGuildChallenge(c.id)}/>
      ))}
      {pastGC.length > 0 && <h3 className="section-sub-title" style={{ margin:"20px 0 12px" }}>History</h3>}
      {pastGC.map(c => <GuildChallengeCard key={c.id} c={c} guildId={guild.id} past/>)}
    </div>
  );
}

function GuildMemberRow({ uid, name, isOwner, guildId, ownerUid, me, toast }) {
  const [p, setP] = useState(null);
  useEffect(() => { getUserProfile(uid).then(setP); }, [uid]);
  if (!p) return null;
  const li = getLevelInfo(p.xp || 0);
  const isLeader = uid === ownerUid;
  return (
    <div className="friend-card">
      {(p.customPhotoURL || p.photoURL)
        ? <img src={p.customPhotoURL || p.photoURL} className="friend-avatar" referrerPolicy="no-referrer" alt=""/>
        : <div className="friend-avatar placeholder">{(name || p.displayName)?.[0]}</div>}
      <div className="friend-info">
        <div className="friend-name">{name || p.displayName} {isLeader && <Crown size={13} style={{ verticalAlign:"-2px" }} title="Guild leader"/>}</div>
        <div style={{ fontSize:12, color:li.current.color }}>{li.current.emoji} {li.current.title}</div>
        <div style={{ fontSize:12, color:"#888", display:"flex", alignItems:"center", gap:4 }}>
          <Zap size={12}/> {p.xp || 0} XP · <Flame size={12}/> {p.streak || 0} streak
        </div>
      </div>
      {isOwner && uid !== me && (
        <button className="challenge-btn" title="Remove from guild" onClick={async () => {
          if (confirm(`Remove ${name || p.displayName} from the guild?`)) { await kickGuildMember(guildId, uid); toast("Member removed", "info"); }
        }}><X size={14}/></button>
      )}
    </div>
  );
}

function GuildChallengeCard({ c, guildId, past, isOwner, onAccept, onDecline }) {
  const incoming   = c.toGuildId === guildId;
  const isFrom     = c.fromGuildId === guildId;
  const myName     = isFrom ? c.fromGuildName  : c.toGuildName;
  const myEmoji    = isFrom ? c.fromGuildEmoji : c.toGuildEmoji;
  const rivalName  = isFrom ? c.toGuildName    : c.fromGuildName;
  const rivalEmoji = isFrom ? c.toGuildEmoji   : c.fromGuildEmoji;
  const myGain     = isFrom ? c.fromGain : c.toGain;
  const rivalGain  = isFrom ? c.toGain   : c.fromGain;
  const myGuildId  = isFrom ? c.fromGuildId : c.toGuildId;
  const iWon       = c.winner === myGuildId;

  return (
    <div className="challenge-card-full">
      <div className="challenge-icon" style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
        <span>{myEmoji}</span><Swords size={16}/><span>{rivalEmoji}</span>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{myName} vs {rivalName}</div>
        <div style={{ fontSize:12, color:"#888", marginTop:2 }}>
          Squad XP race · {c.fromMembers?.length || 0} vs {c.toMembers?.length || 0} members · ends {c.endsAt}
        </div>

        {c.status==="pending" && incoming && isOwner && (
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={onAccept} style={{ width:"auto", padding:"6px 16px", fontSize:13 }}>Accept</button>
            <button className="btn-secondary" onClick={onDecline} style={{ padding:"6px 16px" }}>Decline</button>
          </div>
        )}
        {c.status==="pending" && incoming && !isOwner && <div style={{ fontSize:12, color:"#FF9800", marginTop:8, display:"flex", alignItems:"center", gap:4 }}><Hourglass size={12}/> Waiting for your guild leader to respond</div>}
        {c.status==="pending" && !incoming && <div style={{ fontSize:12, color:"#FF9800", marginTop:8, display:"flex", alignItems:"center", gap:4 }}><Hourglass size={12}/> Waiting for {rivalName} to accept</div>}

        {c.status==="active" && (
          <div style={{ display:"flex", gap:16, marginTop:8, fontSize:13 }}>
            <span style={{ color:"var(--accent)" }}>{myName}: +{myGain ?? 0} XP</span>
            <span style={{ color:"#4DC9FF" }}>{rivalName}: +{rivalGain ?? 0} XP</span>
          </div>
        )}

        {c.status==="completed" && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:14, fontWeight:700, color: c.winner==="tie" ? "#888" : iWon ? "#00FF88" : "#FF4D4D" }}>
              {c.winner==="tie" ? "🤝 Tie!" : iWon ? "🏆 Your guild won!" : `${rivalName} won`}
            </div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{myName} +{myGain ?? 0} XP · {rivalName} +{rivalGain ?? 0} XP</div>
          </div>
        )}
        {c.status==="declined" && <div style={{ fontSize:12, color:"#666", marginTop:8 }}>Declined</div>}
      </div>
    </div>
  );
}

function ChallengeCard({ c, uid, past, onAccept, onDecline }) {
  const incoming = c.to===uid;
  const opponent = c.from===uid ? c.toName : c.fromName;
  const myGain   = c.from===uid ? c.fromGain : c.toGain;
  const theirGain= c.from===uid ? c.toGain   : c.fromGain;
  const iWon     = c.winner===uid;

  return (
    <div className="challenge-card-full">
      <div className="challenge-icon"><Swords size={16}/></div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>
          {c.from===uid ? `You vs ${c.toName}` : `${c.fromName} vs You`}
        </div>
        <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{c.type} · ends {c.endsAt}</div>

        {c.status==="pending" && incoming && (
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button className="btn-primary" onClick={onAccept} style={{ width:"auto", padding:"6px 16px", fontSize:13 }}>Accept</button>
            <button className="btn-secondary" onClick={onDecline} style={{ padding:"6px 16px" }}>Decline</button>
          </div>
        )}
        {c.status==="pending" && !incoming && <div style={{ fontSize:12, color:"#FF9800", marginTop:8, display:"flex", alignItems:"center", gap:4 }}><Hourglass size={12}/> Waiting for {c.toName} to accept</div>}

        {c.status==="active" && (
          <div style={{ display:"flex", gap:16, marginTop:8, fontSize:13 }}>
            <span style={{ color:"var(--accent)" }}>You: +{myGain ?? 0} XP</span>
            <span style={{ color:"#4DC9FF" }}>{opponent}: +{theirGain ?? 0} XP</span>
          </div>
        )}

        {c.status==="completed" && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:14, fontWeight:700, color: c.winner==="tie"?"#888":iWon?"#00FF88":"#FF4D4D" }}>
              {c.winner==="tie" ? "🤝 Tie!" : iWon ? "🏆 You won!" : `${opponent} won`}
            </div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>You +{myGain ?? 0} XP · {opponent} +{theirGain ?? 0} XP</div>
          </div>
        )}
        {c.status==="declined" && <div style={{ fontSize:12, color:"#666", marginTop:8 }}>Declined</div>}
      </div>
    </div>
  );
}
