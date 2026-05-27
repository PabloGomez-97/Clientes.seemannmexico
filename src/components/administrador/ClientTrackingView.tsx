import { useCallback, useState } from "react";
import ShipsGoTracking from "../Sidebar/Shipsgotracking";
import CreateShipmentForm from "../Sidebar/New-tracking";
import CreateOceanShipmentForm from "../Sidebar/New-ocean-tracking";

type TrackingFormType = "air" | "ocean" | null;

interface ClientTrackingViewProps {
  clientUsername: string;
  initialTrackingTab?: "air" | "ocean";
}

function ClientTrackingView({
  clientUsername,
  initialTrackingTab,
}: ClientTrackingViewProps) {
  const [showCreateForm, setShowCreateForm] = useState<TrackingFormType>(null);
  const [trackingKey, setTrackingKey] = useState(0);

  const handleNewTracking = useCallback((type: "air" | "ocean") => {
    setShowCreateForm(type);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateForm(null);
    setTrackingKey((current) => current + 1);
  }, []);

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(null);
  }, []);

  return (
    <>
      {showCreateForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.48)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreateForm(null);
            }
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 25px 50px rgba(15, 23, 42, 0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1f2937",
                  }}
                >
                  Crear tracking{" "}
                  {showCreateForm === "air" ? "aéreo" : "marítimo"}
                </h3>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Para: <strong>{clientUsername}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateCancel}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#9ca3af",
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "0 8px" }}>
              {showCreateForm === "air" ? (
                <CreateShipmentForm
                  referenceUsername={clientUsername}
                  onSuccess={handleCreateSuccess}
                  onCancel={handleCreateCancel}
                />
              ) : (
                <CreateOceanShipmentForm
                  referenceUsername={clientUsername}
                  onSuccess={handleCreateSuccess}
                  onCancel={handleCreateCancel}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <ShipsGoTracking
        key={`${clientUsername}-${trackingKey}`}
        filterUsername={clientUsername}
        onNewTracking={handleNewTracking}
        initialTab={initialTrackingTab}
      />
    </>
  );
}

export default ClientTrackingView;
