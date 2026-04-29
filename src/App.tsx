import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Entry from './pages/Entry';
import DataBank from './pages/DataBank';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SharedData from './pages/SharedData';
import VisitingCard from './pages/VisitingCard';
import Documents from './pages/Documents';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="entry" element={<Entry />} />
            <Route path="data-bank" element={<DataBank />} />
            <Route path="shared-leads" element={<SharedData />} />
            <Route path="reports" element={<Reports />} />
            <Route path="my-card" element={<VisitingCard />} />
            <Route path="documents" element={<Documents />} />
            
            <Route path="settings" element={
              <ProtectedRoute roles={['Admin', 'Owner']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
