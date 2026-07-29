import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RoleProvider } from './context/RoleContext';
import { DataProvider } from './context/DataContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import App from './App';
import { HelpPage } from './pages/HelpPage';
import './index.css';

/** Minimal path routing — /help is a hidden companion page (no main-nav link). */
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isHelp = path === '/help';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isHelp ? (
      <HelpPage />
    ) : (
      <RoleProvider>
        <DataProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </DataProvider>
      </RoleProvider>
    )}
  </StrictMode>,
);
