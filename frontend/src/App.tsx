import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Catalog from './pages/Catalog';
import Quality from './pages/Quality';
import Lineage from './pages/Lineage';
import ROI from './pages/ROI';
import Ingestion from './pages/Ingestion';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/lineage" element={<Lineage />} />
          <Route path="/roi" element={<ROI />} />
          <Route path="/ingestion" element={<Ingestion />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
