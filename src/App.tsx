import { useState } from "react";
import { ComingSoon } from "./components/ComingSoon";
import { Sidebar } from "./components/Sidebar";
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
        {section === "profiles" ? <ProfilesPage /> : <ComingSoon title={es.sections[section]} />}
      </main>
    </div>
  );
}

export default App;
