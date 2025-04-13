import React from 'react';
import { Route, Switch } from 'wouter';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import TopNav from './components/TopNav';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ItineraryPage from './pages/ItineraryPage';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <main className="flex-1">
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/profile">
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            </Route>
            <Route path="/itinerary/:id">
              <ItineraryPage />
            </Route>
            <Route path="/">
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            </Route>
          </Switch>
        </main>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;