import { Menu, Settings as SettingsIcon, MessageCircle } from "lucide-react";

// Mobile-only persistent header — replaces the old floating hamburger +
// floating AI-chat FAB, which drifted over page content (checkin bar,
// scan results, etc.) at narrow widths. Hidden on desktop via CSS.
export default function MobileTopbar({ onOpenSidebar, onOpenSettings, onOpenAI }) {
  return (
    <div className="mobile-topbar">
      <button className="mtb-btn" onClick={onOpenSidebar} aria-label="Open menu">
        <Menu size={20}/>
      </button>
      <div className="mtb-brand">GRIND</div>
      <div className="mtb-actions">
        <button className="mtb-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <SettingsIcon size={18}/>
        </button>
        <button className="mtb-btn" onClick={onOpenAI} aria-label="Ask your coach" title="Ask your coach">
          <MessageCircle size={18}/>
        </button>
      </div>
    </div>
  );
}
