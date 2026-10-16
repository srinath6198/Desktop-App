import { PageTitle } from "../../components/ui/PageUI"
import OnlineDataBase from "./OnlineDataBase"

function BackupSettings() {
  return (
    <div className="screen">
      <PageTitle
        description="Configure your cloud backup connection and manage encrypted backups."
        title="Backup Settings"
      />
      <OnlineDataBase />
    </div>
  )
}

export default BackupSettings
