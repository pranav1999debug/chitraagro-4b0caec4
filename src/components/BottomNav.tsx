import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowRightLeft, Users, Receipt, UserCog, Wallet, Settings } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';

const tabs = [
  { path: '/', icon: LayoutDashboard, key: 'nav.dashboard' },
  { path: '/operations', icon: ArrowRightLeft, key: 'nav.operations' },
  { path: '/customers', icon: Users, key: 'nav.customers' },
  { path: '/payments', icon: Wallet, key: 'nav.payments' },
  { path: '/expenses', icon: Receipt, key: 'nav.expenses' },
  { path: '/settings', icon: Settings, key: 'nav.settings' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useApp();

  // Don't show on login/join pages
  if (location.pathname === '/login' || location.pathname === '/join') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, key }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`bottom-tab ${active ? 'bottom-tab-active' : 'bottom-tab-inactive'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] leading-tight">{t(key, lang)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
