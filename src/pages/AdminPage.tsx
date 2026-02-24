import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AdminLayout from "./admin/AdminLayout";
import AdminUsers from "./admin/AdminUsers";
import AdminAdmins from "./admin/AdminAdmins";
import AdminCountries from "./admin/AdminCountries";
import AdminVisaTypes from "./admin/AdminVisaTypes";
import AdminInterviews from "./admin/AdminInterviews";
import AdminExportCenter from "./admin/AdminExportCenter";
import AdminDiscounts from "./admin/AdminDiscounts";
import AdminTransactions from "./admin/AdminTransactions";

export default function AdminPage() {
  return (
    <DashboardLayout>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="countries" element={<AdminCountries />} />
          <Route path="visa-types" element={<AdminVisaTypes />} />
          <Route path="interviews" element={<AdminInterviews />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="export-center" element={<AdminExportCenter />} />
        </Route>
      </Routes>
    </DashboardLayout>
  );
}
