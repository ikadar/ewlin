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
import { useRouteDocumentTitle } from './hooks/useDocumentTitle';
import App from './App';
import { RootLayout } from './components/RootLayout';
import { RequireAuth } from './components/Auth/RequireAuth';
import { RequirePermission } from './components/Auth/RequirePermission';
import { RequireEnv } from './components/Auth/RequireEnv';
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
import { SafetyZonePage } from './pages/SafetyZonePage';
import { PrecedenceGapPage } from './pages/PrecedenceGapPage';
import { PaperLeadTimePage } from './pages/PaperLeadTimePage';
import { FormeLeadTimePage } from './pages/FormeLeadTimePage';
import { PlateLeadTimePage } from './pages/PlateLeadTimePage';
import { JobsDeTestPage } from './pages/JobsDeTestPage';
import { FluxPage } from './pages/FluxPage';
import { OutsourcedProvidersPage } from './pages/OutsourcedProvidersPage';
import { LogistiquePage } from './pages/LogistiquePage';
import { ProductionReportPage } from './pages/ProductionReportPage';
import { FacturationPage } from './pages/FacturationPage';
import { ShippersPage } from './pages/ShippersPage';
import OperatorsPage from './pages/OperatorsPage';
import OperatorSchedulePage from './pages/OperatorSchedulePage';
import FocusPage from './pages/FocusPage';
import { FocusLayout } from './components/FocusLayout';
import { MobileLayout } from './components/MobileLayout';
import { MobilePage } from './pages/MobilePage';
import StatsPage from './pages/StatsPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { UserGroupsPage } from './pages/UserGroupsPage';
import { ArchivesPage } from './pages/ArchivesPage';
import { AuditPage } from './pages/AuditPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { PapierPage } from './pages/PapierPage';
import { FormesPage } from './pages/FormesPage';
import { BatPage } from './pages/BatPage';
import { PlaquesPage } from './pages/PlaquesPage';
import { PrerequisLayout, PrerequisIndexRedirect } from './components/PrerequisLayout/PrerequisLayout';
import { ScenarioShell } from './components/ScenarioShell';
import { HistoryLayout } from './components/HistoryLayout';
import { QrCodesFocusPage } from './pages/QrCodesFocusPage';

/**
 * Application routes.
 * All routes are nested under RootLayout which provides the Sidebar.
 * Settings routes are further nested under SettingsLayout which provides the submenu.
 */
export function AppRoutes() {
  useRouteDocumentTitle();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Focus view — minimal layout, no sidebar, mobile-first */}
      <Route element={<RequireAuth><FocusLayout /></RequireAuth>}>
        <Route path="/focus/operator/:id" element={<FocusPage mode="operator" />} />
        <Route path="/focus/station/:id" element={<FocusPage mode="station" />} />
      </Route>

      {/* Mobile card stack — operator at-the-machine view */}
      <Route element={<MobileLayout />}>
        <Route path="/mobile/operator/:id" element={<MobilePage mode="operator" />} />
        <Route path="/mobile/station/:id" element={<MobilePage mode="station" />} />
      </Route>

      {/* V2 scenario shell — full-screen layout outside RootLayout. */}
      <Route element={<RequireAuth><RequireEnv allowed="preprod"><ScenarioShell /></RequireEnv></RequireAuth>}>
        <Route path="/scenarios/:id" element={<OperatorSchedulePage />} />
        <Route path="/scenarios/:id/stations" element={<App />} />
        <Route path="/scenarios/:id/flux" element={<FluxPage />} />
        <Route path="/scenarios/:id/settings/stations" element={<StationsPage />} />
        <Route path="/scenarios/:id/settings/operators" element={<OperatorsPage />} />
      </Route>

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

        {/* Operator schedule — default view */}
        <Route path="/" element={<OperatorSchedulePage />} />

        {/* Algorithm stats dashboard */}
        <Route path="/stats" element={<StatsPage />} />

        {/* Checklist — unified submenu for prérequis, magasin/expéditions, activité.
            Prod-only: hidden from Préprod (cf. RequireEnv). */}
        <Route element={<RequireEnv allowed="prod"><PrerequisLayout /></RequireEnv>}>
          <Route path="/prerequis">
            <Route index element={<PrerequisIndexRedirect />} />
            <Route path="papier" element={<PapierPage />} />
            <Route path="formes" element={<FormesPage />} />
            <Route path="bat" element={<BatPage />} />
            <Route path="plaques" element={<PlaquesPage />} />
          </Route>
          <Route path="/logistique" element={<LogistiquePage />} />
          <Route path="/rapport-production" element={<ProductionReportPage />} />
          <Route path="/facturation" element={<FacturationPage />} />
        </Route>

        {/* Historique & audit — submenu under HistoryLayout (analogous
            to /settings/*) */}
        <Route path="/historique" element={<HistoryLayout />}>
          <Route index element={<Navigate to="/historique/journal" replace />} />
          <Route path="journal" element={<AuditPage />} />
          <Route path="archives" element={<ArchivesPage />} />
          <Route path="archives/:id" element={<ArchivesPage />} />
        </Route>

        {/* V2 Scenarios — list + entry point into the dedicated shell.
            Préprod-only: the /labo experience doesn't apply in Prod. */}
        <Route path="/scenarios" element={<RequireEnv allowed="preprod"><ScenariosPage /></RequireEnv>} />

        {/* Station schedule — verification view */}
        <Route path="/stations" element={<App />} />
        <Route path="/stations/job/new" element={<App />} />
        <Route path="/stations/job/:jobId" element={<App />} />

        {/* Settings routes — SettingsLayout provides the w-72 submenu */}
        <Route path="/settings" element={<RequirePermission permission={['settings.view', 'admin.users']}><SettingsLayout /></RequirePermission>}>
          <Route index element={<Navigate to="/settings/stations" replace />} />
          <Route path="stations" element={<StationsPage />} />
          <Route path="operators" element={<OperatorsPage />} />
          <Route path="station-categories" element={<StationCategoriesPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="referents" element={<ReferentsPage />} />
          <Route path="formats" element={<FormatsPage />} />
          <Route path="impression-presets" element={<ImpressionPresetsPage />} />
          <Route path="surfacage-presets" element={<SurfacagePresetsPage />} />
          <Route path="feuille-formats" element={<FeuilleFormatsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="safety-zone" element={<SafetyZonePage />} />
          <Route path="precedence-gap" element={<PrecedenceGapPage />} />
          <Route path="paper-lead-time" element={<PaperLeadTimePage />} />
          <Route path="forme-lead-time" element={<FormeLeadTimePage />} />
          <Route path="plate-lead-time" element={<PlateLeadTimePage />} />
          <Route path="tests" element={<JobsDeTestPage />} />
          <Route path="providers" element={<OutsourcedProvidersPage />} />
          <Route path="shippers" element={<ShippersPage />} />
          <Route path="qr-codes-focus" element={<QrCodesFocusPage />} />
          <Route path="users" element={<RequirePermission permission="admin.users"><UsersPage /></RequirePermission>} />
          <Route path="user-groups" element={<RequirePermission permission="admin.users"><UserGroupsPage /></RequirePermission>} />
        </Route>
      </Route>
    </Routes>
  );
}
