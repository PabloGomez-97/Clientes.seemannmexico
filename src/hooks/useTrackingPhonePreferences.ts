import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchTrackingPhonePreference,
  saveTrackingPhonePreference,
} from "../services/trackingPhonePreferences";

export function useTrackingPhonePreferences(
  reference?: string,
  enabled: boolean = true,
) {
  const { token } = useAuth();
  const [phones, setPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !reference || !token) {
      setPhones([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const preference = await fetchTrackingPhonePreference(token, reference);
      setPhones(preference.phones);
    } catch (err) {
      setPhones([]);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los teléfonos.",
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, reference, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (nextPhones: string[]) => {
      if (!reference || !token) {
        throw new Error("No hay sesión activa o cuenta seleccionada.");
      }

      setSaving(true);
      setError(null);

      try {
        const preference = await saveTrackingPhonePreference(
          token,
          reference,
          nextPhones,
        );
        setPhones(preference.phones);
        return preference;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudieron guardar los teléfonos.";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [reference, token],
  );

  return {
    phones,
    loading,
    saving,
    error,
    reload: load,
    save,
  };
}
