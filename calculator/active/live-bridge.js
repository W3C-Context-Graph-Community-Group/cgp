// live-bridge.js — Subscribes to canonical StateClient pipeline and renders
// a Dark Fraction calculator whose variables come from the demo's path spikes.
// Reuses DFC.* components and math from dark-fraction-core.js.

const { useState, useMemo, useCallback, useEffect } = React;

let _liveNextId = 1000;

function extractVariableNames(state) {
  const names = [];
  for (const obs of (state.observatrons || [])) {
    for (const spike of (obs.spikes || [])) {
      const meaning = spike['/meaning']?.key?.[0];
      if (meaning && !names.includes(meaning)) {
        names.push(meaning);
      }
    }
  }
  return names;
}

function LiveCalculator() {
  const [variables, setVariables] = useState([]);

  // Subscribe to canonical state pipeline via StateClient
  useEffect(() => {
    let conn = null;
    window.CGP.connectToState({
      onUpdate(state, seq) {
        const names = extractVariableNames(state);

        if (names.length === 0) {
          setVariables([]);
          return;
        }

        setVariables((prev) => {
          const existingNames = new Set(prev.map((v) => v.name));
          const newVars = names
            .filter((name) => !existingNames.has(name))
            .map((name) => ({
              id: _liveNextId++,
              name,
              facets: [false, false, false],
              facetValues: ["", "", ""],
            }));
          if (newVars.length === 0) return prev;
          return [...prev, ...newVars];
        });
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
          width: 480,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "32px 28px",
          overflowY: "auto",
        }}
      >
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
            {!isEmpty && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={clearAll}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #e0e0e0",
                    background: "#f9f9f9",
                    color: "#FF6B6B",
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                  }}
                >
                  Clear all
                </button>
                <button
                  onClick={verifyAll}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #e0e0e0",
                    background: "#f9f9f9",
                    color: "#4ECDC4",
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                  }}
                >
                  Verify all
                </button>
              </div>
            )}
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
              {/* Facet legend row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 6,
                  marginBottom: 6,
                  paddingRight: 38,
                }}
              >
                {DFC.FACET_NAMES.map((name, i) => (
                  <div
                    key={name}
                    style={{
                      width: 40,
                      textAlign: "center",
                      fontSize: 9,
                      color: DFC.FACET_COLORS[i],
                      opacity: 0.7,
                      letterSpacing: 0.5,
                    }}
                  >
                    {name.slice(0, 3).toUpperCase()}
                  </div>
                ))}
              </div>

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
