import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LoginPage } from "@/pages/auth/Login";
import { RegisterPage } from "@/pages/auth/Register";
import CatalogPage from "@/pages/Catalog";
import IngestionPage from "@/pages/Ingestion";
import LineagePage from "@/pages/Lineage";
import QualityPage from "@/pages/Quality";
import ROIPage from "@/pages/ROI";

// HRBUST 风格的页面组件 - 使用 Ant Design
import DashboardPage from "@/pages/dashboard/Dashboard";
import PlatformMonitor from "@/pages/monitor/PlatformMonitor";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ========================================== */}
        {/* 默认使用侧边栏 AppShell */}
        {/* ========================================== */}
        <Route
          element={
            <AuthGuard>
              <AppShell>
                <Outlet />
              </AppShell>
            </AuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="ingestion" element={<IngestionPage />} />
          <Route path="quality" element={<QualityPage />} />
          <Route path="lineage" element={<LineagePage />} />
          <Route path="roi" element={<ROIPage />} />
          <Route path="bilibili" element={<PlatformMonitor platformName="Bilibili" />} />
          <Route path="bilibili/:roomId" element={<PlatformMonitor platformName="Bilibili" />} />
          <Route path="douyu" element={<PlatformMonitor platformName="Douyu" />} />
          <Route path="douyu/:roomId" element={<PlatformMonitor platformName="Douyu" />} />
          <Route
            path="admin"
            element={
              <AuthGuard requiredRole="admin">
                <AdminDashboard />
              </AuthGuard>
            }
          />
        </Route>

        {/* 重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
