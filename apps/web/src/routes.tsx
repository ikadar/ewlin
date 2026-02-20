/**
 * Route configuration for React Router integration.
 *
 * @see v0.4.38 - React Router Integration
 *
 * Route structure:
 * /                → Main scheduler view (no job selected)
 * /job/:jobId      → Main scheduler with job selected
 * /job/new         → Main scheduler with JCF modal open
 */

import { Routes, Route } from 'react-router-dom';
import App from './App';
import { TemplatesPage } from './pages/TemplatesPage';
import { StationCategoriesPage } from './pages/StationCategoriesPage';
import { ClientsPage } from './pages/ClientsPage';

/**
 * Application routes.
 * All routes render the same App component, but with different URL parameters
 * that control the application state (selected job, modal state).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/job/new" element={<App />} />
      <Route path="/job/:jobId" element={<App />} />
      <Route path="/templates" element={<TemplatesPage />} />
      <Route path="/station-categories" element={<StationCategoriesPage />} />
      <Route path="/clients" element={<ClientsPage />} />
    </Routes>
  );
}
