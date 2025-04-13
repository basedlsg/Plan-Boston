import React from 'react';
import { Route, Switch } from 'wouter';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/">
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        </Route>
      </Switch>
    </AuthProvider>
  );
}

export default App;