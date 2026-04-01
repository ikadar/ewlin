/**
 * Route configuration for React Router integration.
 *
 * @see v0.4.38 - React Router Integration
 * @see v0.5.16 - Flux tab nested routes
 *
 * Route structure:
 * /flux                      → Production Flow Dashboard — Tous tab (v0.5.15)
 * /flux/prepresse            → Production Flow Dashboard — A faire prepresse tab
 * /flux/papier               → Production Flow Dashboard — Cdes papier tab
 * /flux/formes               → Production Flow Dashboard — Cdes formes tab
 * /flux/plaques              → Production Flow Dashboard — Plaques a produire tab
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
 * /settings/providers           → Outsourced provider config
 * /settings/users              → User management (admin)
 * /settings/user-groups        → User group management (admin)
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { RootLayout } from './components/RootLayout';
import { RequireAuth } from './components/Auth/RequireAuth';
import { RequirePermission } from './components/Auth/RequirePermission';
import { SettingsLayout } from './components/SettingsLayout/SettingsLayout';
import { TemplatesPage } from './pages/TemplatesPage';
import { StationCategoriesPage } from './pages/StationCategoriesPage';
import { ClientsPage } from './pages/ClientsPage';
import { ReferentsPage } from './pages/ReferentsPage';
import { FormatsPage } from './pages/FormatsPage';
import { ImpressionPresetsPage } from './pages/ImpressionPresetsPage';
import { SurfacagePresetsPage } from './pages/SurfacagePresetsPage';
import { FeuilleFormatsPage } from './pages/FeuilleFormatsPage';
import { StationsPage } from './pages/StationsPage';
import { FluxPage } from './pages/FluxPage';
import { OutsourcedProvidersPage } from './pages/OutsourcedProvidersPage';
import { ShippersPage } from './pages/ShippersPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { UserGroupsPage } from './pages/UserGroupsPage';

/**
 * Application routes.
 * All routes are nested under RootLayout which provides the Sidebar.
 * Settings routes are further nested under SettingsLayout which provides the submenu.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><RootLayout /></RequireAuth>}>
        {/* Production Flow Dashboard — tab nested routes (v0.5.16) */}
        <Route path="/flux" element={<FluxPage />}>
          <Route index element={null} />
          <Route path="bat" element={null} />
          <Route path="papier" element={null} />
          <Route path="formes" element={null} />
          <Route path="plaques" element={null} />
          <Route path="soustraitance" element={null} />
          <Route path="a-facturer" element={null} />
        </Route>

        {/* Scheduling routes */}
        <Route path="/" element={<App />} />
        <Route path="/job/new" element={<App />} />
        <Route path="/job/:jobId" element={<App />} />

        {/* Settings routes — SettingsLayout provides the w-72 submenu */}
        <Route path="/settings" element={<RequirePermission permission={['settings.view', 'admin.users']}><SettingsLayout /></RequirePermission>}>
          <Route index element={<Navigate to="/settings/stations" replace />} />
          <Route path="stations" element={<StationsPage />} />
          <Route path="station-categories" element={<StationCategoriesPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="referents" element={<ReferentsPage />} />
          <Route path="formats" element={<FormatsPage />} />
          <Route path="impression-presets" element={<ImpressionPresetsPage />} />
          <Route path="surfacage-presets" element={<SurfacagePresetsPage />} />
          <Route path="feuille-formats" element={<FeuilleFormatsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="providers" element={<OutsourcedProvidersPage />} />
          <Route path="shippers" element={<ShippersPage />} />
          <Route path="users" element={<RequirePermission permission="admin.users"><UsersPage /></RequirePermission>} />
          <Route path="user-groups" element={<RequirePermission permission="admin.users"><UserGroupsPage /></RequirePermission>} />
        </Route>
      </Route>
    </Routes>
  );
}
