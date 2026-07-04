import { Navigate } from "react-router-dom";
import { getOfflineSessionSync, useAdmin } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading, user } = useAdmin();
  const pinSession = getOfflineSessionSync();

  // Prevent any rendering until auth check is complete
  if (isLoading && !pinSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user && !pinSession) {
    return <Navigate to="/pos-login" replace />;
  }

  // Block access if not admin
  if (!isAdmin && !pinSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have administrator privileges to access this page.
          </p>
          <a 
            href="/" 
            className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
