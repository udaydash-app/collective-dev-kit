import { Navigate } from "react-router-dom";
import { useAuth } from "@/ledgerly/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!user) return <Navigate to="/ledgerly/auth" replace />;
  return children;
};
