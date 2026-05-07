import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import './index.css';
import { AppRoutes } from './routes.tsx';
import { NowProvider } from './contexts/NowContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <NowProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NowProvider>
    </Provider>
  </StrictMode>
);
