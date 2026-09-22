import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MissionProvider } from './context/MissionContext'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { can, canAny } from './lib/perms'
import { roleDashboardPath } from './lib/roleConfig'

import AccessDenied from './components/AccessDenied'
import Login from './pages/Login'

// ---- shared operational pages --------------------------------------------
import Missions from './pages/Missions'
import MissionDetail from './pages/MissionDetail'
import Personnel from './pages/Personnel'
import Cargo from './pages/Cargo'
import Inventory from './pages/Inventory'
import Assets from './pages/Assets'
import MapPage from './pages/MapPage'
import Weather from './pages/Weather'
import Alerts from './pages/Alerts'
import Simulations from './pages/Simulations'
import Assistant from './pages/Assistant'
import Emergency from './pages/Emergency'
import Reports from './pages/Reports'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Stations from './pages/Stations'
import Tasks from './pages/Tasks'
import Equipment from './pages/Equipment'
import Profile from './pages/Profile'

// ---- role dashboards -----------------------------------------------------
import AdminDashboard from './pages/dashboards/AdminDashboard'
import CommanderDashboard from './pages/dashboards/CommanderDashboard'
import HQDashboard from './pages/dashboards/HQDashboard'
import LogisticsDashboard from './pages/dashboards/LogisticsDashboard'
import ScientistDashboard from './pages/dashboards/ScientistDashboard'
import MedicalDashboard from './pages/dashboards/MedicalDashboard'
import FieldDashboard from './pages/dashboards/FieldDashboard'

// ---- admin console pages -------------------------------------------------
import AdminUsers from './pages/admin/Users'
import AdminRoles from './pages/admin/Roles'
import AdminSystem from './pages/admin/SystemMonitoring'
import AdminAudit from './pages/admin/Audit'
import AdminIntegrations from './pages/admin/Integrations'
import AdminSecurity from './pages/admin/Security'
import AdminConfig from './pages/admin/Config'

// ---- logistics pages -----------------------------------------------------
import ShipmentsPage from './pages/logistics/Shipments'
import ContainersPage from './pages/logistics/Containers'
import ResupplyPage from './pages/logistics/Resupply'
import QrScanPage from './pages/logistics/Scan'

// ---- medical pages -------------------------------------------------------
import MedicalCases from './pages/MedicalCases'
import MedicalInventory from './pages/MedicalInventory'

function RequireAuth({ perm, anyPerm, children }: { perm?: string; anyPerm?: string[]; children: React.ReactNode }) {
  const { user, booting } = useAuth()
  if (booting)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading DHRUVA…" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  if (perm && !can(user.role, perm)) return <AccessDenied />
  if (anyPerm && !canAny(user.role, ...anyPerm)) return <AccessDenied />
  return <>{children}</>
}

/** Deny access entirely when the logged-in role doesn't match the required one. */
function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { user, booting } = useAuth()
  if (booting)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading DHRUVA…" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <AccessDenied />
  return <>{children}</>
}

function Shell() {
  const { user, booting } = useAuth()
  if (booting)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Loading DHRUVA…" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

function RedirectToDashboard() {
  const { user } = useAuth()
  return <Navigate to={roleDashboardPath(user?.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MissionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Shell />}>
              <Route index element={<RedirectToDashboard />} />

              {/* ---------- Role dashboards ---------- */}
              <Route path="admin/dashboard" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
              <Route path="commander/dashboard" element={<RequireRole role="commander"><CommanderDashboard /></RequireRole>} />
              <Route path="hq/dashboard" element={<RequireRole role="hq"><HQDashboard /></RequireRole>} />
              <Route path="logistics/dashboard" element={<RequireRole role="logistics"><LogisticsDashboard /></RequireRole>} />
              <Route path="scientist/dashboard" element={<RequireRole role="scientist"><ScientistDashboard /></RequireRole>} />
              <Route path="medical/dashboard" element={<RequireRole role="medical"><MedicalDashboard /></RequireRole>} />
              <Route path="field/dashboard" element={<RequireRole role="field"><FieldDashboard /></RequireRole>} />

              {/* ---------- Admin console ---------- */}
              <Route path="admin/users" element={<RequireRole role="admin"><AdminUsers /></RequireRole>} />
              <Route path="admin/roles" element={<RequireRole role="admin"><AdminRoles /></RequireRole>} />
              <Route path="admin/system" element={<RequireRole role="admin"><AdminSystem /></RequireRole>} />
              <Route path="admin/audit" element={<RequireAuth perm="audit:read"><AdminAudit /></RequireAuth>} />
              <Route path="admin/integrations" element={<RequireRole role="admin"><AdminIntegrations /></RequireRole>} />
              <Route path="admin/security" element={<RequireRole role="admin"><AdminSecurity /></RequireRole>} />
              <Route path="admin/config" element={<RequireRole role="admin"><AdminConfig /></RequireRole>} />

              {/* ---------- Shared operational ---------- */}
              <Route path="missions" element={<RequireAuth perm="mission:read"><Missions /></RequireAuth>} />
              <Route path="missions/:id" element={<RequireAuth perm="mission:read"><MissionDetail /></RequireAuth>} />
              <Route path="personnel" element={<RequireAuth perm="personnel:read"><Personnel /></RequireAuth>} />
              <Route path="cargo" element={<RequireAuth perm="cargo:read"><Cargo /></RequireAuth>} />
              <Route path="inventory" element={<RequireAuth perm="inventory:read"><Inventory /></RequireAuth>} />
              <Route path="assets" element={<RequireAuth perm="assets:read"><Assets /></RequireAuth>} />
              <Route path="map" element={<RequireAuth perm="maps:read"><MapPage /></RequireAuth>} />
              <Route path="weather" element={<RequireAuth perm="weather:read"><Weather /></RequireAuth>} />
              <Route path="alerts" element={<RequireAuth perm="alerts:read"><Alerts /></RequireAuth>} />
              <Route path="simulations" element={<RequireAuth perm="simulate:use"><Simulations /></RequireAuth>} />
              <Route path="assistant" element={<RequireAuth perm="ai:use"><Assistant /></RequireAuth>} />
              <Route path="emergency" element={<RequireAuth anyPerm={['emergency:read', 'emergency:report']}><Emergency /></RequireAuth>} />
              <Route path="reports" element={<RequireAuth perm="reports:use"><Reports /></RequireAuth>} />
              <Route path="analytics" element={<RequireAuth perm="analytics:use"><Analytics /></RequireAuth>} />
              <Route path="stations" element={<RequireAuth perm="mission:read"><Stations /></RequireAuth>} />
              <Route path="settings" element={<Settings />} />

              {/* ---------- HQ ---------- */}
              {/* stations route shared above */}

              {/* ---------- Logistics ---------- */}
              <Route path="logistics/shipments" element={<RequireAuth perm="cargo:read"><ShipmentsPage /></RequireAuth>} />
              <Route path="logistics/containers" element={<RequireAuth perm="cargo:read"><ContainersPage /></RequireAuth>} />
              <Route path="logistics/resupply" element={<RequireAuth anyPerm={['cargo:read', 'inventory:read']}><ResupplyPage /></RequireAuth>} />
              <Route path="logistics/scan" element={<RequireAuth perm="cargo:read"><QrScanPage /></RequireAuth>} />

              {/* ---------- Scientist / Field / Medical shared ---------- */}
              <Route path="scientist/tasks" element={<RequireAuth perm="tasks:use"><Tasks scope="scientist" /></RequireAuth>} />
              <Route path="field/tasks" element={<RequireAuth perm="tasks:use"><Tasks scope="field" /></RequireAuth>} />
              <Route path="scientist/equipment" element={<RequireAuth perm="assets:read"><Equipment scope="scientist" /></RequireAuth>} />
              <Route path="field/equipment" element={<RequireAuth perm="assets:read"><Equipment scope="field" /></RequireAuth>}
              />
              <Route path="field/profile" element={<Profile />} />

              {/* ---------- Medical ---------- */}
              <Route path="medical/cases" element={<RequireAuth perm="medical:read"><MedicalCases /></RequireAuth>} />
              <Route path="medical/inventory" element={<RequireAuth perm="inventory:read"><MedicalInventory /></RequireAuth>} />

              <Route path="*" element={<RedirectToDashboard />} />
            </Route>
          </Routes>
        </MissionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}