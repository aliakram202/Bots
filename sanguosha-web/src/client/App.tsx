import { useEffect, useState } from 'react';
import { TooltipLayer } from './components/Tooltip';
import { api } from './net';
import { Home, RoomPage } from './pages';

function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return path;
}

export function App() {
  const path = useRoute();
  const [debugAllowed, setDebugAllowed] = useState(false);
  useEffect(() => {
    api<{ debugAllowed: boolean }>('/api/config').then((c) => setDebugAllowed(c.debugAllowed)).catch(() => {});
  }, []);
  const m = path.match(/^\/room\/([A-Za-z0-9]{4,8})\/?$/);
  return (
    <>
      {m ? <RoomPage key={m[1].toUpperCase()} code={m[1].toUpperCase()} /> : <Home debugAllowed={debugAllowed} />}
      <TooltipLayer />
    </>
  );
}
