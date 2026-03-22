import { createContext, useContext, useState, useCallback, useRef } from "react";
import { WS_API, getToken } from "../config";

const OperationContext = createContext(null);

export function useOperations() {
  return useContext(OperationContext);
}

export function OperationProvider({ children }) {
  const [operations, setOps] = useState([]);
  const wsRefs = useRef({});

  const updateOp = useCallback((id, patch) => {
    setOps((prev) => prev.map((op) => (op.id === id ? { ...op, ...patch } : op)));
  }, []);

  const startOperation = useCallback(
    ({ schemaId, schemaName, action, inputs, region, env, resourceId }) => {
      const id = `${action}-${Date.now()}`;

      const op = {
        id,
        schemaId,
        schemaName: schemaName || schemaId,
        action,
        status: "running",
        logs: `Starting terraform ${action}...\n`,
        startedAt: Date.now(),
        expanded: false,
      };

      setOps((prev) => [op, ...prev]);

      const token = getToken();
      const wsUrl = token
        ? `${WS_API}/api/ws/run?token=${token}`
        : `${WS_API}/api/ws/run`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRefs.current[id] = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              schemaId,
              inputs,
              region,
              env,
              action,
              ...(resourceId && { resourceId }),
            })
          );
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "log") {
            setOps((prev) =>
              prev.map((o) =>
                o.id === id ? { ...o, logs: o.logs + msg.data + "\n" } : o
              )
            );
          } else if (msg.type === "done") {
            const finalStatus = msg.status === "error" ? "error" : "done";
            updateOp(id, { status: finalStatus, duration: msg.duration, planId: msg.plan_id });
          } else if (msg.type === "approval_required") {
            setOps((prev) =>
              prev.map((o) =>
                o.id === id
                  ? {
                      ...o,
                      status: "done",
                      logs:
                        o.logs +
                        `\nApproval Required\n\n${msg.data}\n`,
                    }
                  : o
              )
            );
          } else if (msg.type === "error") {
            setOps((prev) =>
              prev.map((o) =>
                o.id === id
                  ? { ...o, status: "error", logs: o.logs + "ERROR: " + msg.data + "\n" }
                  : o
              )
            );
          } else if (msg.type === "started") {
            updateOp(id, { recordId: msg.data });
          }
        };

        ws.onerror = () => {
          updateOp(id, { status: "error" });
        };

        ws.onclose = () => {
          delete wsRefs.current[id];
        };
      } catch {
        updateOp(id, { status: "error" });
      }

      return id;
    },
    [updateOp]
  );

  const dismissOperation = useCallback((id) => {
    if (wsRefs.current[id]) {
      wsRefs.current[id].close();
      delete wsRefs.current[id];
    }
    setOps((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const toggleExpand = useCallback((id) => {
    setOps((prev) =>
      prev.map((op) => (op.id === id ? { ...op, expanded: !op.expanded } : op))
    );
  }, []);

  const getOperation = useCallback(
    (id) => operations.find((op) => op.id === id),
    [operations]
  );

  return (
    <OperationContext.Provider
      value={{ operations, startOperation, dismissOperation, toggleExpand, getOperation }}
    >
      {children}
    </OperationContext.Provider>
  );
}
