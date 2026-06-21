import AppHeader from "@/components/AppHeader";
import AdminPane from "@/components/AdminPane";

export default function AdminPage() {
  return (
    <main className="flex h-screen flex-col">
      <AppHeader
        active="admin"
        subtitle="Full-screen admin - action log + live CRM state"
      />
      <div className="h-[calc(100vh-3.25rem)]">
        <AdminPane />
      </div>
    </main>
  );
}
