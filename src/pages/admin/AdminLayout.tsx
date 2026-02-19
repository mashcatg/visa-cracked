import { Link, Outlet, useLocation } from "react-router-dom";
import { Users, Shield, Globe, FileText, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Admins", href: "/admin/admins", icon: Shield },
  { label: "Countries", href: "/admin/countries", icon: Globe },
  { label: "Visa Types", href: "/admin/visa-types", icon: Stamp },
  { label: "All Interviews", href: "/admin/interviews", icon: FileText },
];

export default function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage users, content, and interviews</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
