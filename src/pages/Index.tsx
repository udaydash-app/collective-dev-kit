import { Navigate } from "react-router-dom";

export default function Index() {
  // Immediate redirect without useEffect delay
  return <Navigate to="/pos-login" replace />;
}
