import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './shared/auth/AuthContext';
import { DarkModeProvider } from './shared/hooks/DarkModeContext';
import { bootstrapImpersonationFromHash } from './shared/impersonation/session';
import './shared/i18n';
import './styles/index.css';

// Capture an impersonation token handed to this tab via the URL hash (before any
// API call fires), so tenant requests in this tab run as the impersonated user.
bootstrapImpersonationFromHash();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <DarkModeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </DarkModeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
