import { useAuth } from "../../auth/AuthContext";
import SettingsClient from "./SettingsClient";

function Settings() {
  const { user, activeUsername } = useAuth();

  return (
    <SettingsClient
      reference={activeUsername}
      username={user?.nombreuser || user?.username || "Usuario"}
      email={user?.email || ""}
    />
  );
}

export default Settings;
