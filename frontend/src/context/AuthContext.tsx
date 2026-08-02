import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, UserRole } from '../types/marketplace';
import { db } from '../db';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  switchRole: (newRole: UserRole) => void;
  login: (email: string, name?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const DEFAULT_GUEST: UserProfile = {
  id: 'guest-user',
  email: 'guest@dokion.io',
  name: 'Anonymous Guest',
  handle: 'guest',
  avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-06-focus.svg',
  role: 'GUEST',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const DEFAULT_MEMBER: UserProfile = {
  id: 'usr-member-01',
  email: 'dev@company.com',
  name: 'Alex Vance',
  handle: 'alexvance',
  avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-03-terminal.svg',
  role: 'MEMBER',
  bio: 'Senior Security Engineer building automated DevSecOps pipelines.',
  createdAt: Date.now() - 86400000 * 30,
  updatedAt: Date.now()
};

const DEFAULT_CREATOR: UserProfile = {
  id: 'usr-creator-01',
  email: 'publisher@dokion.io',
  name: 'CyberShield Labs',
  handle: 'cybershield',
  avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-04-guardian.svg',
  role: 'CREATOR',
  publisherId: 'pub-cybershield-01',
  bio: 'Verified publisher specializing in REST API scanning and OWASP compliance playbooks.',
  website: 'https://cybershieldlabs.io',
  githubHandle: 'cybershieldlabs',
  createdAt: Date.now() - 86400000 * 120,
  updatedAt: Date.now()
};

const DEFAULT_MODERATOR: UserProfile = {
  id: 'usr-mod-01',
  email: 'moderator@dokion.io',
  name: 'Sarah Chen (Security Lead)',
  handle: 'sarah_mod',
  avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-02-reviewer.svg',
  role: 'MODERATOR',
  bio: 'Dokion Core Security Auditor & Moderation Lead.',
  createdAt: Date.now() - 86400000 * 200,
  updatedAt: Date.now()
};

const DEFAULT_ADMIN: UserProfile = {
  id: 'usr-admin-01',
  email: 'admin@dokion.io',
  name: 'Dokion Admin',
  handle: 'dokion_admin',
  avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-01-core.svg',
  role: 'ADMIN',
  bio: 'Platform Administrator & Infrastructure Operator.',
  createdAt: Date.now() - 86400000 * 365,
  updatedAt: Date.now()
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('dokion_active_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_MEMBER;
      }
    }
    return DEFAULT_MEMBER;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('dokion_active_user', JSON.stringify(user));
      db.users.put(user).catch(() => {});
    } else {
      localStorage.removeItem('dokion_active_user');
    }
  }, [user]);

  const switchRole = (newRole: UserRole) => {
    switch (newRole) {
      case 'GUEST':
        setUser(DEFAULT_GUEST);
        break;
      case 'MEMBER':
        setUser(DEFAULT_MEMBER);
        break;
      case 'CREATOR':
        setUser(DEFAULT_CREATOR);
        break;
      case 'MODERATOR':
        setUser(DEFAULT_MODERATOR);
        break;
      case 'ADMIN':
        setUser(DEFAULT_ADMIN);
        break;
    }
  };

  const login = async (email: string, name?: string) => {
    const handle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newUser: UserProfile = {
      id: `usr-${Date.now().toString(36)}`,
      email,
      name: name || handle,
      handle,
      avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-03-terminal.svg',
      role: 'MEMBER',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setUser(newUser);
    await db.users.put(newUser);
  };

  const logout = () => {
    setUser(DEFAULT_GUEST);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data, updatedAt: Date.now() };
    setUser(updated);
    await db.users.put(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : 'GUEST',
        isAuthenticated: user !== null && user.role !== 'GUEST',
        switchRole,
        login,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
