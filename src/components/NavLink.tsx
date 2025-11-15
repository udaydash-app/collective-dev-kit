import { Link, LinkProps, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps extends LinkProps {
  activeClassName?: string;
  end?: boolean;
}

export const NavLink = ({ 
  to, 
  children, 
  className, 
  activeClassName = 'font-semibold text-primary', 
  end = false,
  ...props 
}: NavLinkProps) => {
  const location = useLocation();
  const isActive = end 
    ? location.pathname === to 
    : location.pathname.startsWith(to.toString());

  return (
    <Link
      to={to}
      className={cn("pointer-events-auto cursor-pointer", className, isActive && activeClassName)}
      {...props}
    >
      {children}
    </Link>
  );
};
