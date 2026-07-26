import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '../types';
import { readStored, writeStored } from '../state/storage';

/**
 * FR4 — the active role view, plus which professor a Faculty view represents
 * (the picker default is Professor A). Faculty row-scoping happens centrally
 * in DataContext using this value.
 */

export const DEFAULT_FACULTY_PROFESSOR = 'Professor A';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  facultyProfessor: string;
  setFacultyProfessor: (professor: string) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

interface StoredRole {
  role: Role;
  facultyProfessor: string;
}

const ROLES: Role[] = ['faculty', 'chair', 'admin'];

export function RoleProvider({ children }: { children: ReactNode }) {
  const [stored] = useState<StoredRole>(() => {
    const raw = readStored<StoredRole>('role', {
      role: 'faculty',
      facultyProfessor: DEFAULT_FACULTY_PROFESSOR,
    });
    return {
      role: ROLES.includes(raw.role) ? raw.role : 'faculty',
      facultyProfessor:
        typeof raw.facultyProfessor === 'string' && raw.facultyProfessor.length > 0
          ? raw.facultyProfessor
          : DEFAULT_FACULTY_PROFESSOR,
    };
  });
  const [role, setRole] = useState<Role>(stored.role);
  const [facultyProfessor, setFacultyProfessor] = useState(stored.facultyProfessor);

  useEffect(() => {
    writeStored<StoredRole>('role', { role, facultyProfessor });
  }, [role, facultyProfessor]);

  return (
    <RoleContext.Provider value={{ role, setRole, facultyProfessor, setFacultyProfessor }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useRole must be used inside <RoleProvider>');
  return value;
}
