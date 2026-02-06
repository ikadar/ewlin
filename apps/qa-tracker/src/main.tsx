import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import './index.css';
import { QATrackerPage } from './qa/QATrackerPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QATrackerPage />
    </Provider>
  </StrictMode>
);
