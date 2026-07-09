import { createRoot } from 'react-dom/client';
import './index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import Router from './Router.tsx';

// Initialize default theme before React mounts to avoid flash
try {
  const stored = localStorage.getItem('theme');
  if (stored !== 'light') {
    document.documentElement.classList.add('dark');
  }
} catch {
  // ignore if localStorage is unavailable
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <Router />
  </TooltipProvider>,
);
