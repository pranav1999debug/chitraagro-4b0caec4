import { useApp } from '@/contexts/AppContext';
import { Languages } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export default function AppHeader({ title }: HeaderProps) {
  const { lang, toggleLang } = useApp();

  return (
    <header className="sticky top-0 bg-card border-b border-border z-20 px-4 py-3 flex items-center justify-between">
      <h1 className="font-heading text-xl font-bold text-foreground">{title}</h1>
      <button
        onClick={toggleLang}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-body"
      >
        <Languages size={14} />
        {lang === 'en' ? 'हिंदी' : 'EN'}
      </button>
    </header>
  );
}
