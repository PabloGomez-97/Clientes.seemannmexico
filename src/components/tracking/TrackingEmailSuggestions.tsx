import { normalizeEmail } from "../../services/trackingEmailPreferences";

interface TrackingEmailSuggestionsProps {
  savedEmails: string[];
  selectedEmails: string[];
  onSelectEmail: (email: string) => void;
  onAddAll?: () => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}

function TrackingEmailSuggestions({
  savedEmails,
  selectedEmails,
  onSelectEmail,
  onAddAll,
  disabled = false,
}: TrackingEmailSuggestionsProps) {
  if (savedEmails.length === 0) {
    return null;
  }

  const selectedSet = new Set(
    selectedEmails.filter(Boolean).map((email) => normalizeEmail(email)),
  );
  const allSelected = savedEmails.every((email) =>
    selectedSet.has(normalizeEmail(email)),
  );
  const visibleEmails = savedEmails.filter(
    (email) => !selectedSet.has(normalizeEmail(email)),
  );

  if (visibleEmails.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      ></div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleEmails.map((email) => {
          return (
            <button
              key={email}
              type="button"
              onClick={() => onSelectEmail(email)}
              disabled={disabled}
              style={{
                border: `1px solid #d1d5db`,
                background: "#ffffff",
                color: "#374151",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 500,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              + {email}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TrackingEmailSuggestions;
