/**
 * Route configuration for React Router integration.
 *
 * @see v0.4.38 - React Router Integration
 *
 * Route structure:
 * /                          → Main scheduler view (no job selected)
 * /job/:jobId                → Main scheduler with job selected
 * /job/new                   → Main scheduler with JCF modal open
 * /settings/stations         → Station config
 * /settings/station-categories → Station category config
 * /settings/clients          → Client config
 * /settings/formats          → Format config
 * /settings/impression-presets → Impression preset config
 * /settings/surfacage-presets  → Surfacage preset config
 * /settings/feuille-formats    → Feuille format (imposition) config
 * /settings/templates          → Template config
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { RootLayout } from './components/RootLayout';
import { SettingsLayout } from './components/SettingsLayout/SettingsLayout';
import { TemplatesPage } from './pages/TemplatesPage';
import { StationCategoriesPage } from './pages/StationCategoriesPage';
import { ClientsPage } from './pages/ClientsPage';
import { FormatsPage } from './pages/FormatsPage';
import { ImpressionPresetsPage } from './pages/ImpressionPresetsPage';
import { SurfacagePresetsPage } from './pages/SurfacagePresetsPage';
import { FeuilleFormatsPage } from './pages/FeuilleFormatsPage';
import { StationsPage } from './pages/StationsPage';

/**
 * Application routes.
 * All routes are nested under RootLayout which provides the Sidebar.
 * Settings routes are further nested under SettingsLayout which provides the submenu.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* Scheduling routes */}
        <Route path="/" element={<App />} />
        <Route path="/job/new" element={<App />} />
        <Route path="/job/:jobId" element={<App />} />

        {/* Settings routes — SettingsLayout provides the w-72 submenu */}
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/stations" replace />} />
          <Route path="stations" element={<StationsPage />} />
          <Route path="station-categories" element={<StationCategoriesPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="formats" element={<FormatsPage />} />
          <Route path="impression-presets" element={<ImpressionPresetsPage />} />
          <Route path="surfacage-presets" element={<SurfacagePresetsPage />} />
          <Route path="feuille-formats" element={<FeuilleFormatsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
