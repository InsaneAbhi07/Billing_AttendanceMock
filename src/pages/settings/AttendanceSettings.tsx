import AttendanceRules from '../attendance/AttendanceRules'

/** Settings → Attendance Settings: the core subset of the attendance rules (same underlying settings). */
export default function AttendanceSettingsPage() {
  return <AttendanceRules compact />
}
