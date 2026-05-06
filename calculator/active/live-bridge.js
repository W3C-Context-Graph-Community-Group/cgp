// live-bridge.js — Subscribes to canonical StateClient pipeline and renders
// a Dark Fraction calculator whose variables come from the demo's path spikes.
// Reuses DFC.* components and math from dark-fraction-core.js.

const { useState, useMemo, useCallback, useEffect, useRef } = React;

let _liveNextId = 1000;

function extractVariables(state) {
  const vars = [];
  for (const obs of (state.observatrons || [])) {
    for (const spike of (obs.spikes || [])) {
      const name = spike['/meaning']?.key?.[0] || '';
      const mBit = (spike['/meaning']?.key?.length > 0);
      const sBit = (spike['/structure']?.key?.length > 0);
      const cBit = (spike['/context']?.timestamp?.length > 0);

      vars.push({
        id: _liveNextId++,
        name,
        dataValue: spike['/data']?.value ?? null,
        facets: [mBit, sBit, cBit],
        facetValues: [
          mBit ? (spike['/meaning']?.value?.[0] || '') : '',
          sBit ? (spike['/structure']?.value?.[0] || '') : '',
          cBit ? (spike['/context']?.channel?.[0] || '') : '',
        ],
      });
    }
  }
  return vars;
}

function LiveCalculator() {
  const [variables, setVariables] = useState([]);

  // Subscribe to canonical state pipeline via StateClient
  useEffect(() => {
    let conn = null;
    window.CGP.connectToState({
      onUpdate(state, seq) {
        setVariables(extractVariables(state));
      },
    }).then((c) => { conn = c; });
    return () => { if (conn) conn.close(); };
  }, []);

  const m = variables.length;
  const r = variables.reduce(
    (sum, v) => sum + v.facets.filter((f) => f).length,
    0
  );
  const result = useMemo(() => DFC.computeDarkFraction(m, r), [m, r]);

  const toggleFacet = useCallback((id, facetIndex) => {
    setVariables((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, facets: v.facets.map((f, i) => (i === facetIndex ? !f : f)) }
          : v
      )
    );
  }, []);

  const removeVariable = useCallback((id) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const renameVariable = useCallback((id, name) => {
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
  }, []);

  const updateFacetValue = useCallback((id, facetIndex, value) => {
    setVariables((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, facetValues: v.facetValues.map((fv, i) => (i === facetIndex ? value : fv)) }
          : v
      )
    );
  }, []);

  const verifyAll = useCallback(() => {
    setVariables((prev) => prev.map((v) => ({ ...v, facets: [true, true, true] })));
  }, []);

  const clearAll = useCallback(() => {
    setVariables((prev) => prev.map((v) => ({ ...v, facets: [false, false, false] })));
  }, []);

  const isEmpty = variables.length === 0;

  const [rpWidth, setRpWidth] = useState(480);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef(null);

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rpWidth;
    setResizing(true);
    const onMove = (ev) => {
      const w = Math.min(800, Math.max(280, startW + (startX - ev.clientX)));
      setRpWidth(w);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rpWidth]);

  return (
    <div
      style={{
        height: "100vh",
        background: "#f5f5f5",
        color: "#333",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700;800&display=swap"
        rel="stylesheet"
      />

      {/* MIDDLE COLUMN - visualization & stats */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 40px",
          overflowY: "auto",
          borderRight: "1px solid #e0e0e0",
        }}
      >
        <div style={{ maxWidth: 520, width: "100%" }}>
          {/* Gauge card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 16,
              padding: "24px 24px 16px",
              marginBottom: 16,
            }}
          >
            <DFC.DarkFractionGauge delta={result.delta} phi={result.phi} />
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF6B6B" }} />
                <span style={{ fontSize: 11, color: "#888" }}>Dark</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#4ECDC4" }} />
                <span style={{ fontSize: 11, color: "#888" }}>Verified</span>
              </div>
            </div>
          </div>

          {/* Stats card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <DFC.StatCard label="Variables (m)" value={m} color="#222" />
              <DFC.StatCard label="Facets (n=3m)" value={result.n} color="#222" />
              <DFC.StatCard label="Verified (r)" value={r} color="#3bb8ad" />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DFC.StatCard
                label="|&Omega;| configs"
                value={DFC.formatLargeNumber(result.logOmega)}
                color="#888"
                sub="2^n"
              />
              <DFC.StatCard
                label="|B&#x1D63;| verified"
                value={DFC.formatLargeNumber(result.logBr)}
                color="#3bb8ad"
                sub="Hamming ball"
              />
            </div>

            {m > 0 && <DFC.MarginalReturnBar m={m} r={r} />}
          </div>

          {/* Dark uncertainty explanation */}
          {result.delta > 0.5 && m > 0 && (
            <div
              style={{
                background: "#fff5f5",
                border: "1px solid #ffcccc",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
              }}
            >
              <div style={{ color: "#FF6B6B", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                &#9888; Dark uncertainty dominates
              </div>
              <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>
                With {m} variables and {r} verified facets, {DFC.formatDelta(result.delta)} of the
                configuration space is unreachable by any within-boundary diagnostic. The system is
                operating somewhere in a space of {DFC.formatLargeNumber(result.logOmega)}{" "}
                configurations but can only confirm {DFC.formatLargeNumber(result.logBr)} of them.
              </div>
            </div>
          )}

          {result.delta === 0 && m > 0 && (
            <div
              style={{
                background: "#f0faf7",
                border: "1px solid #b3e6d4",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
              }}
            >
              <div style={{ color: "#4ECDC4", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                &#10003; Collapsed uncertainty
              </div>
              <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>
                All facets verified. The boundary occupies a single known point in the configuration
                space.
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: 28,
              paddingTop: 14,
              borderTop: "1px solid #e0e0e0",
              color: "#bbb",
              fontSize: 10,
            }}
          >
            W3C Context Graph Community Group
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - boundary variables (no presets) */}
      <div
        style={{
          width: rpWidth,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "32px 28px",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: -4,
            bottom: 0,
            width: 8,
            cursor: "col-resize",
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 3,
              bottom: 0,
              width: 2,
              background: resizing ? "#4a90d9" : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (!resizing) e.currentTarget.style.background = "#4a90d9"; }}
            onMouseLeave={(e) => { if (!resizing) e.currentTarget.style.background = "transparent"; }}
          />
        </div>
        {/* Variables card */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                color: "#999",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Boundary variables
            </div>
          </div>

          {isEmpty ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 8,
                color: "#bbb",
                fontSize: 13,
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <div style={{ fontSize: 28, opacity: 0.4 }}>&#x25C7;</div>
              <div>Drop a CSV on /demo to populate variables.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {variables.map((v, i) => (
                  <DFC.VariableRow
                    key={v.id}
                    variable={v}
                    index={i}
                    hideFacetToggles
                    showAllFacets
                    onToggleFacet={(fi) => toggleFacet(v.id, fi)}
                    onRemove={() => removeVariable(v.id)}
                    onRename={(name) => renameVariable(v.id, name)}
                    onUpdateFacetValue={(fi, val) => updateFacetValue(v.id, fi, val)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.LiveCalculator = LiveCalculator;
