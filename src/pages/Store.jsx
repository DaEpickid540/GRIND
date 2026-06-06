import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { purchaseItem, equipItem, unequipItem } from "../lib/firebase";
import { STORE_ITEMS, RARITY_COLORS } from "../data/storeItems";
import { useToast } from "../components/Toast";

const TABS = [
  { id:"all",    label:"All"             },
  { id:"title",  label:"🏷️ Titles"       },
  { id:"badge",  label:"🎖️ Badges"       },
  { id:"frame",  label:"🖼️ Frames"       },
  { id:"streak", label:"🔥 Streak Icons" },
];

function FramePreview({ display }) {
  const frameClass = `preview-frame frame-${display}`;
  return (
    <div className={frameClass}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>👤</span>
    </div>
  );
}

export default function Store() {
  const { user, profile } = useAuth();
  const { showToast }     = useToast();
  const [tab,    setTab]    = useState("all");
  const [buying, setBuying] = useState(null);

  const coins    = profile?.coins       || 0;
  const owned    = profile?.ownedItems  || [];
  const equipped = profile?.equippedItems || {};

  const items = tab === "all"
    ? STORE_ITEMS
    : STORE_ITEMS.filter(i => i.type === tab);

  async function handleBuy(item) {
    if (!user || buying) return;
    if (coins < item.cost) { showToast("Not enough coins! 🪙", "error"); return; }
    setBuying(item.id);
    try {
      await purchaseItem(user.uid, item);
      showToast(`Purchased ${item.name}! 🎉`, "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBuying(null);
    }
  }

  async function handleEquip(item) {
    if (!user) return;
    const isEquipped = equipped[item.equip_slot] === item.id;
    try {
      if (isEquipped) {
        await unequipItem(user.uid, item.equip_slot);
        showToast(`Unequipped ${item.name}`, "info");
      } else {
        await equipItem(user.uid, item.equip_slot, item.id);
        showToast(`Equipped ${item.name}! ✨`, "success");
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="store-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>🏪 Store</h2>
          <p className="store-subtitle">Cosmetics earned by actually grinding. Free. Forever.</p>
        </div>
        <div className="store-coin-display">
          <span className="store-coin-icon">🪙</span>
          <span className="store-coin-amount">{coins.toLocaleString()}</span>
          <span className="store-coin-label">coins</span>
        </div>
      </div>

      <div className="store-earn-tip">
        💡 Earn <strong>1 coin per habit</strong> completed each day — no purchases, no pay-to-win.
      </div>

      {/* ── Tabs ── */}
      <div className="store-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`store-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Equipped showcase ── */}
      {Object.keys(equipped).filter(k => equipped[k]).length > 0 && (
        <div className="store-equipped-bar">
          <span className="store-equipped-label">Currently equipped:</span>
          {Object.entries(equipped).map(([slot, id]) => {
            if (!id) return null;
            const item = STORE_ITEMS.find(i => i.id === id);
            if (!item) return null;
            return (
              <span key={slot} className="store-equipped-chip" style={{ borderColor: RARITY_COLORS[item.rarity] }}>
                {item.type === "title" ? `"${item.display}"` : item.display} <span style={{ color:"#555", fontSize:10 }}>{item.type}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Item grid ── */}
      <div className="store-grid">
        {items.map(item => {
          const isOwned    = owned.includes(item.id);
          const isEquipped = equipped[item.equip_slot] === item.id;
          const canAfford  = coins >= item.cost;
          const isLoading  = buying === item.id;

          return (
            <div
              key={item.id}
              className={`store-card${isOwned ? " owned" : ""}${isEquipped ? " equipped" : ""}`}
              style={{ "--rarity-color": RARITY_COLORS[item.rarity] }}
            >
              {/* Rarity glow bar */}
              <div className="store-card-rarity-bar" style={{ background: RARITY_COLORS[item.rarity] }}/>

              <div className="store-card-icon">{item.icon}</div>
              <div className="store-card-name">{item.name}</div>
              <div className="store-card-rarity" style={{ color: RARITY_COLORS[item.rarity] }}>
                {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
              </div>
              <div className="store-card-desc">{item.desc}</div>

              {/* Live preview of what equipped looks like */}
              <div className="store-card-preview">
                {item.type === "title"  && (
                  <span className="preview-title" style={{ color: RARITY_COLORS[item.rarity] }}>
                    [{item.display}]
                  </span>
                )}
                {item.type === "badge"  && (
                  <span className="preview-badge">{item.display}</span>
                )}
                {item.type === "frame"  && (
                  <FramePreview display={item.display} />
                )}
                {item.type === "streak" && (
                  <span className="preview-streak">{item.display} <span style={{color:"#aaa"}}>42</span></span>
                )}
              </div>

              <div className="store-card-footer">
                {isOwned ? (
                  <button
                    className={`store-btn${isEquipped ? " store-btn-equipped" : " store-btn-equip"}`}
                    onClick={() => handleEquip(item)}
                  >
                    {isEquipped ? "✓ Equipped" : "Equip"}
                  </button>
                ) : (
                  <button
                    className={`store-btn store-btn-buy${!canAfford ? " cant-afford" : ""}`}
                    onClick={() => handleBuy(item)}
                    disabled={isLoading || !canAfford}
                    title={!canAfford ? `Need ${item.cost - coins} more coins` : ""}
                  >
                    {isLoading ? "…" : (
                      <>
                        <span>🪙</span>
                        <span>{item.cost.toLocaleString()}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="store-footer-note">
        All cosmetics are permanent once purchased. Equip and swap freely anytime.
      </p>
    </div>
  );
}
