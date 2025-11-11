import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { history } from "../api";

export default function HistoryModal({ isOpen, onClose, projectCode, partNumber }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revisions, setRevisions] = useState([]);

  useEffect(() => {
    if (!isOpen || !projectCode || !partNumber) return;
    
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // Extract project details from projectCode (format: NUMBER_NAME)
        const [projectNumber, ...rest] = projectCode.split("_");
        const projectName = rest.join("_");
        
        // Extract type and number from partNumber (format: TXXX where T is type)
        const typePrefix = partNumber.charAt(0);
        const numberOnly = partNumber.slice(1);

        const data = await history({
          projectNumber,
          projectName,
          typePrefix,
          partNumber: numberOnly
        });

        if (mounted) {
          setRevisions(data.history || []);
          if (!data.history?.length) {
            setError("No history found for this part.");
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load history");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [isOpen, projectCode, partNumber]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 grid place-items-center p-4 z-50">
      <div className="card w-full max-w-xl p-6 relative max-h-[90vh] flex flex-col">
        <button className="absolute right-4 top-4 text-slate-500" onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="flex-none">
          <div className="text-lg font-semibold mb-1">VERSION HISTORY</div>
          <div className="text-2xl font-bold mb-4">{partNumber}</div>
          <div className="text-xs text-slate-500 mb-4">Project {projectCode}</div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && <div className="text-center py-8">Loading...</div>}
          
          {error && <div className="text-center py-8 text-slate-500">{error}</div>}
          
          {!loading && !error && revisions.length > 0 && (
            <div className="space-y-4">
              {revisions.map((rev, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center">
                    {rev.rev || "?"}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{rev.fileName}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(rev.time).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-none mt-6">
          <div className="flex justify-end">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
