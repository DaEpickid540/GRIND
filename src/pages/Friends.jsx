import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { sendFriendRequest, acceptFriendRequest, declineFriendRequest,
         watchIncomingRequests, getFriendsProfiles, getUserProfile,
         sendChallenge, watchMyChallenges, acceptChallenge, declineChallenge, resolveChallenge } from "../lib/firebase";
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
    QRCode.toCanvas(canvasRef.current, addUrl, { width:200, margin:2, color:{ dark:"#FFD700", light:"#111111" }});
  }, [uid]);

  return (
    <div className="qr-display">
      <canvas ref={canvasRef} className="qr-canvas"/>
      <div className="qr-name">{displayName}</div>
      <div className="qr-url">{addUrl.replace(window.location.origin,"")}</div>
      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(addUrl); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
          style={{ width:"auto", padding:"8px 20px", fontSize:14 }}>
          {copied ? "✅ Copied!" : "📋 Copy Link"}
        </button>
        <button className="btn-secondary" onClick={() => { const l=document.createElement("a"); l.download=`grind-qr-${displayName}.png`; l.href=canvasRef.current.toDataURL(); l.click(); }}>
          ⬇️ Save QR
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
          <span>⚡ {friend.xp||0} XP</span>
          <span>🔥 {friend.streak||0} streak</span>
          <span className={`checkin-pill ${checkedInToday?"done":""}`}>{checkedInToday?"✅ checked in":"⏳ not yet"}</span>
        </div>
      </div>
      <button className="challenge-btn" onClick={() => onChallenge(friend)} title="Challenge to 7-day XP race">⚔️</button>
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
        <div><h1 className="page-title">👥 Friends</h1><p className="page-sub">Add friends via QR. Track streaks. Battle for XP.</p></div>
        {(requests.length>0 || activeChallenges.length>0) && (
          <div style={{ display:"flex", gap:8 }}>
            {requests.length>0 && <div className="req-badge">{requests.length} request{requests.length>1?"s":""}</div>}
            {activeChallenges.length>0 && <div className="req-badge" style={{ borderColor:"#B84DFF", color:"#B84DFF", background:"#15001a" }}>{activeChallenges.length} ⚔️</div>}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom:20 }}>
        {[["friends","👥 Friends"],["add","➕ Add"],["requests","📬 Requests"],["challenges","⚔️ Challenges"]].map(([id,label]) => (
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={() => setTab(id)}>
            {label}
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
              <div style={{ fontSize:56 }}>👥</div><h3>No friends yet</h3>
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
              {!scanning && <div className="camera-placeholder">📷</div>}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {!scanning
                ? <button className="btn-primary" onClick={startScan} style={{ width:"auto", padding:"10px 24px" }}>📷 Start Scan</button>
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
              <div style={{ fontSize:48 }}>⚔️</div>
              <p style={{ color:"#888" }}>No challenges yet. Challenge a friend to a 7-day XP race!</p>
            </div>
          )}
          {activeChallenges.length>0 && <h3 className="section-sub-title" style={{ marginBottom:12 }}>Active</h3>}
          {activeChallenges.map(c => <ChallengeCard key={c.id} c={c} uid={user.uid} onAccept={()=>acceptChallenge(c.id)} onDecline={()=>declineChallenge(c.id)}/>)}
          {pastChallenges.length>0 && <h3 className="section-sub-title" style={{ margin:"24px 0 12px" }}>History</h3>}
          {pastChallenges.map(c => <ChallengeCard key={c.id} c={c} uid={user.uid} past/>)}
        </div>
      )}
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
        <div style={{ fontSize:12, color:"#888" }}>⚡ {profile.xp||0} XP · 🔥 {profile.streak||0} streak</div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-primary" onClick={onAccept} style={{ width:"auto", padding:"7px 16px", fontSize:13 }}>Accept</button>
        <button className="btn-secondary" onClick={onDecline} style={{ padding:"7px 16px" }}>Decline</button>
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
      <div className="challenge-icon">⚔️</div>
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
        {c.status==="pending" && !incoming && <div style={{ fontSize:12, color:"#FF9800", marginTop:8 }}>⏳ Waiting for {c.toName} to accept</div>}

        {c.status==="active" && (
          <div style={{ display:"flex", gap:16, marginTop:8, fontSize:13 }}>
            <span style={{ color:"#FFD700" }}>You: +{myGain ?? 0} XP</span>
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
