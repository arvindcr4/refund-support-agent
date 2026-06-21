import AppHeader from "@/components/AppHeader";
import Console from "@/components/Console";

export default function Home() {
  return (
    <main className="flex h-screen flex-col">
      <AppHeader
        active="console"
        subtitle="Two-pane agent console - chat left, live admin right"
      />
      <Console />
    </main>
  );
}
