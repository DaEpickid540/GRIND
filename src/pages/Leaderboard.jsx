import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { watchLeaderboard, sendChallenge, getFriendsProfiles } from "../lib/firebase";
import { getLevelInfo } from "../data/gameData";
import { useToast } from "../components/Toast";

export default function Leaderboard() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [board,      setBoard]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [challenged, setChallenged] = useState({});
  const [scope,      setScope]      = useState("global"); // global | friends

  // Real-time leaderboard listener
  useEffect(() => {
    const unsub = watchLeaderboard(50, data => { setBoard(data); setLoading(false); });
    return () => unsub();
  }, []);

  const [friendUids, setFriendUids] = useState([]);
  useEffect(() => { setFriendUids(profile?.friends || []); }, [profile]);

  async function challenge(target) {
    try {
      await sendChallenge(user.uid, user.displayName, target.uid, target.displayName, "7-day XP race", 7);
      setChallenged(c => ({ ...c, [target.uid]: true }));
      toast(`Challenge sent to ${target.displayName}! ⚔️`, "success");
    } catch(e) { toast("Failed to send challenge", "error"); }
  }

  const shown = scope==="friends"
    ? board.filter(p => friendUids.includes(p.uid) || p.uid===user?.uid)
    : board;

  if (loading) return <div className="page-content"><div className="loading-card"><div className="spinner"/><p>Loading leaderboard…</p></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🏆 Leaderboard</h1><p className="page-sub">Live rankings by XP · updates in real time</p></div>
        <div className="tabs">
          <button className={`tab-btn ${scope==="global"?"active":""}`} onClick={()=>setScope("global")}>🌍 Global</button>
          <button className={`tab-btn ${scope==="friends"?"active":""}`} onClick={()=>setScope("friends")}>👥 Friends</button>
        </div>
      </div>

      {scope==="friends" && shown.length<=1 && (
        <div className="empty-state-card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:48 }}>👥</div>
          <p style={{ color:"#888" }}>Add friends to see how you stack up against them.</p>
        </div>
      )}

      <div className="board-table">
        <div className="board-thead">
          <span>#</span><span>Player</span><span>Level</span><span>XP</span><span>Streak</span><span></span>
        </div>
        {shown.map((p,i) => {
          const li    = getLevelInfo(p.xp||0);
          const me    = p.uid===user?.uid;
          const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
          return (
            <div key={p.uid} className={`board-row ${me?"mine":""}`}>
              <span className="board-rank">{medal}</span>
              <div className="board-player">
                {p.photoURL && <img src={p.customPhotoURL||p.photoURL} className="board-avatar" referrerPolicy="no-referrer" alt=""/>}
                <div><div className="board-name">{p.displayName} {me&&<span className="you-tag">YOU</span>}</div></div>
              </div>
              <span style={{ color:li.current.color, fontSize:13 }}>{li.current.emoji} {li.current.title}</span>
              <span style={{ color:"#FFD700", fontFamily:"'Bebas Neue',sans-serif", fontSize:22 }}>{p.xp||0}</span>
              <span style={{ color:"#FF4D4D" }}>🔥 {p.streak||0}</span>
              <span>
                {!me && (
                  <button className={`challenge-btn ${challenged[p.uid]?"sent":""}`} onClick={()=>challenge(p)} disabled={!!challenged[p.uid]}>
                    {challenged[p.uid]?"Sent!":"⚔️ Challenge"}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
