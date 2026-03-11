import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowRightLeft, Users, Wallet, MoreHorizontal, Receipt, UserCog, ShoppingCart, Settings, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';

const mainTabs = [
  { path: '/', icon: LayoutDashboard, key: 'nav.dashboard' },
  { path: '/operations', icon: ArrowRightLeft, key: 'nav.operations' },
  { path: '/customers', icon: Users, key: 'nav.customers' },
  { path: '/payments', icon: Wallet, key: 'nav.payments' },
];

const moreTabs = [
  { path: '/expenses', icon: Receipt, key: 'nav.expenses' },
  { path: '/staff', icon: UserCog, key: 'nav.staff' },
  { path: '/procurement', icon: ShoppingCart, key: 'nav.procurement' },
  { path: '/settings', icon: Settings, key: 'nav.settings' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  if (location.pathname === '/login' || location.pathname === '/join') return null;

  const isMoreActive = moreTabs.some(tab => location.pathname === tab.path);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 bg-foreground/30 z-30" onClick={() => setMoreOpen(false)} />
      )}

      {/* More menu popup */}
      {moreOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto bg-card rounded-xl border border-border shadow-lg p-2">
            <div className="flex justify-between items-center px-3 py-1">
              <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-muted-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {moreTabs.map(({ path, icon: Icon, key }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => { navigate(path); setMoreOpen(false); }}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                    <span className="text-[10px] leading-tight font-body">{t(key, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {mainTabs.map(({ path, icon: Icon, key }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => { navigate(path); setMoreOpen(false); }}
                className={`bottom-tab ${active ? 'bottom-tab-active' : 'bottom-tab-inactive'}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] leading-tight">{t(key, lang)}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`bottom-tab ${isMoreActive || moreOpen ? 'bottom-tab-active' : 'bottom-tab-inactive'}`}
          >
            <MoreHorizontal size={20} strokeWidth={isMoreActive || moreOpen ? 2.5 : 1.5} />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
