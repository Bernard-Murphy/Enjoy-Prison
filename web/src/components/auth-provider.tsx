"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AuthDialog } from "@/components/auth-dialog";

interface AuthContextType {
  showLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const showLoginModal = () => setLoginModalOpen(true);

  return (
    <AuthContext.Provider value={{ showLoginModal }}>
      {children}
      <AuthDialog
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        onSuccess={() => setLoginModalOpen(false)}
        onCancel={() => setLoginModalOpen(false)}
      />
    </AuthContext.Provider>
  );
}
