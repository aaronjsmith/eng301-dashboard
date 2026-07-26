import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RoleProvider } from './context/RoleContext';
import { DataProvider } from './context/DataContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoleProvider>
      <DataProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </DataProvider>
    </RoleProvider>
  </StrictMode>,
);
