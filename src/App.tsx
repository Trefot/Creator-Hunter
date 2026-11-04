import { useState } from "react";
import { ComingSoon } from "./components/ComingSoon";
import { Sidebar } from "./components/Sidebar";
import { GoalsPage } from "./features/goals/GoalsPage";
import { IncomePage } from "./features/income/IncomePage";
import { ProfilesPage } from "./features/profiles/ProfilesPage";
import { es } from "./i18n/es";
import { Section } from "./sections";
import "./App.css";

function App() {
  // Perfiles es la sección inicial mientras el Dashboard no exista.
  const [section, setSection] = useState<Section>("profiles");

  return (
    <div className="layout">
      <Sidebar current={section} onSelect={setSection} />
      <main className="content">
        {section === "profiles" ? (
          <ProfilesPage />
        ) : section === "goals" ? (
          <GoalsPage />
        ) : section === "income" ? (
          <IncomePage />
        ) : (
          <ComingSoon title={es.sections[section]} />
        )}
      </main>
    </div>
  );
}

export default App;
