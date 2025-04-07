import React from 'react';
import Logo from './Logo';
import UserMenu from './auth/UserMenu';

const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center py-4 mb-6">
      <div className="logo-container transform scale-50 origin-left">
        <Logo />
      </div>
      <div className="user-menu">
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;