// dark-fraction-core.js — shared IIFE that exposes window.DFC
// All math, data model, and React components extracted verbatim from 1.html.
(function () {
const { useState, useMemo, useCallback, useRef, useEffect } = React;

function parseCsvHeader(text) {
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) return [];
  return firstLine.split(",").map(h => h.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

// --- CSV data model ---
let _csvIdCounter = 1;

class CsvObject {
  constructor({ filename, column_names, is_selected = true, is_default = false }) {
    this.id = _csvIdCounter++;
    this.filename = filename;
    this.column_names = column_names;
    this.is_selected = is_selected;
    this.is_default = is_default;
  }
  get() {
    return {
      filename: this.filename,
      column_names: this.column_names,
      is_selected: this.is_selected,
    };
  }
}

class CsvStore {
  constructor() {
    this._items = {};
  }
  add(csv) {
    const obj = csv instanceof CsvObject ? csv : new CsvObject(csv);
    this._items[obj.id] = obj;
    return obj.id;
  }
  remove(id) {
    delete this._items[id];
  }
  get(id) {
    return this._items[id];
  }
  getAll() {
    return Object.values(this._items);
  }
  setSelected(id, is_selected) {
    if (this._items[id]) this._items[id].is_selected = is_selected;
  }
}

const DEFAULT_CSVS = [
  {
    filename: "trading_boundary.csv",
    column_names: ["Date", "Oil Price", "Location"],
    is_selected: true,
    is_default: true,
  },
  {
    filename: "bond_trading.csv",
    column_names: ["Date", "Oil Price", "Location", "Trade ID", "Counterparty"],
    is_selected: false,
    is_default: true,
  },
  {
    filename: "simple_api.csv",
    column_names: ["user_id", "timestamp"],
    is_selected: false,
    is_default: true,
  },
];

// --- Math utilities using logarithms to handle large numbers ---
function logBinom(n, k) {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  if (k > n - k) k = n - k;
  let result = 0;
  for (let i = 0; i < k; i++) {
    result += Math.log2(n - i) - Math.log2(i + 1);
  }
  return result;
}

function logHammingBall(n, r) {
  if (r >= n) return n;
  if (r < 0) return -Infinity;
  let maxLog = logBinom(n, 0);
  for (let k = 1; k <= r; k++) {
    maxLog = Math.max(maxLog, logBinom(n, k));
  }
  let sum = 0;
  for (let k = 0; k <= r; k++) {
    sum += Math.pow(2, logBinom(n, k) - maxLog);
  }
  return maxLog + Math.log2(sum);
}

function computeDarkFraction(m, r) {
  const n = 3 * m;
  if (n === 0) return { delta: 0, phi: 1, logBr: 0, logOmega: 0, n, exact: true };
  if (r >= n) return { delta: 0, phi: 1, logBr: n, logOmega: n, n, exact: true };
  const logOmega = n;
  const logBr = logHammingBall(n, r);
  const phi = Math.pow(2, logBr - logOmega);
  const delta = 1 - phi;
  return { delta, phi, logBr, logOmega, n, exact: false };
}

function formatLargeNumber(logVal) {
  if (logVal <= 0) return "1";
  const log10Val = logVal * Math.log10(2);
  if (log10Val < 6) {
    return Math.round(Math.pow(2, logVal)).toLocaleString();
  }
  const mantissa = Math.pow(10, log10Val - Math.floor(log10Val));
  const exponent = Math.floor(log10Val);
  return `${mantissa.toFixed(2)} × 10^${exponent}`;
}

function formatDelta(delta) {
  if (delta === 0) return "0%";
  if (delta === 1) return "100%";
  if (delta >= 0.99999) {
    const nines = -Math.log10(1 - delta);
    return `≈ ${"9".repeat(Math.min(Math.floor(nines), 12))}.${"9".repeat(Math.max(0, Math.min(Math.ceil(nines) - Math.floor(nines) > 0 ? 1 : 0, 4)))}%`.replace(/\.$/, "%");
  }
  if (delta > 0.9999) return `${(delta * 100).toFixed(6)}%`;
  if (delta > 0.99) return `${(delta * 100).toFixed(4)}%`;
  return `${(delta * 100).toFixed(2)}%`;
}

// --- Components ---

const FACET_LABELS = ["M", "S", "C"];
const FACET_NAMES = ["Meaning", "Structure", "Context"];
const FACET_COLORS = ["#FF6B6B", "#4ECDC4", "#A78BFA"];

function FacetToggle({ active, color, label, fullName, onClick }) {
  return (
    <button
      onClick={onClick}
      title={fullName}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: active ? `2px solid ${color}` : "2px solid #ddd",
        background: active ? `${color}18` : "#fff",
        color: active ? color : "#aaa",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(circle at center, ${color}15, transparent)`,
          }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
    </button>
  );
}

function FacetInputRow({ facetIndex, value, onChange }) {
  const color = FACET_COLORS[facetIndex];
  const name = FACET_NAMES[facetIndex];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 46px",
        background: `${color}08`,
        borderRadius: 8,
        border: `1px solid ${color}25`,
        marginTop: 2,
      }}
    >
      <span
        style={{
          color: color,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          width: 64,
          flexShrink: 0,
        }}
      >
        {name}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${name} verification value...`}
        style={{
          flex: 1,
          background: "#fff",
          border: `1px solid ${color}40`,
          borderRadius: 6,
          padding: "4px 8px",
          color: "#333",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          outline: "none",
          minWidth: 0,
        }}
      />
    </div>
  );
}

function VariableRow({ variable, index, onToggleFacet, onRemove, onRename, onUpdateFacetValue }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variable.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "#f9f9f9",
          borderRadius: 10,
          border: "1px solid #eee",
        }}
      >
        <span
          style={{
            color: "#999",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            width: 24,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          v{index + 1}
        </span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onRename(name); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename(name); setEditing(false); } }}
            style={{
              flex: 1,
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "4px 8px",
              color: "#333",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              outline: "none",
              minWidth: 0,
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              color: "#555",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              cursor: "text",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {variable.name}
          </span>
        )}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {FACET_LABELS.map((label, i) => (
            <FacetToggle
              key={label}
              active={variable.facets[i]}
              color={FACET_COLORS[i]}
              label={label}
              fullName={FACET_NAMES[i]}
              onClick={() => onToggleFacet(i)}
            />
          ))}
        </div>
        <button
          onClick={onRemove}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid #e0e0e0",
            background: "transparent",
            color: "#bbb",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontFamily: "system-ui",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      {variable.facets.map((active, i) =>
        active ? (
          <FacetInputRow
            key={i}
            facetIndex={i}
            value={variable.facetValues[i]}
            onChange={(val) => onUpdateFacetValue(i, val)}
          />
        ) : null
      )}
    </div>
  );
}

function DarkFractionGauge({ delta, phi }) {
  const circumference = 2 * Math.PI * 90;
  const darkArc = circumference * delta;
  const verifiedArc = circumference * phi;

  return (
    <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto" }}>
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="100" cy="100" r="90" fill="none" stroke="#e8e8e8" strokeWidth="16" />
        <circle
          cx="100" cy="100" r="90"
          fill="none"
          stroke="#FF6B6B"
          strokeWidth="16"
          strokeDasharray={`${darkArc} ${circumference - darkArc}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <circle
          cx="100" cy="100" r="90"
          fill="none"
          stroke="#4ECDC4"
          strokeWidth="16"
          strokeDasharray={`${verifiedArc} ${circumference - verifiedArc}`}
          strokeDashoffset={`${-darkArc}`}
          strokeLinecap="round"
          style={{ transition: "all 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 28,
            fontWeight: 800,
            color: "#FF6B6B",
            lineHeight: 1,
          }}
        >
          δ
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 16,
            color: "#555",
            marginTop: 4,
          }}
        >
          {formatDelta(delta)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div
      style={{
        background: "#f9f9f9",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: "14px 16px",
        flex: 1,
        minWidth: 130,
      }}
    >
      <div style={{ color: "#999", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: color || "#555", fontSize: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: "#bbb", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function MarginalReturnBar({ m, r }) {
  const n = 3 * m;
  if (n === 0 || r >= n) return null;

  const bars = [];
  const maxBars = Math.min(n, 30);
  let maxVal = -Infinity;

  for (let k = 0; k < maxBars; k++) {
    const val = logBinom(n, k + 1) - n;
    if (val > maxVal) maxVal = val;
  }

  for (let k = 0; k < maxBars; k++) {
    const logMarginal = logBinom(n, k + 1) - n;
    const height = Math.max(2, ((logMarginal - (maxVal - 10)) / 10) * 60);
    const isVerified = k < r;
    bars.push(
      <div
        key={k}
        title={`Facet ${k + 1}: marginal gain`}
        style={{
          width: Math.max(4, Math.floor(260 / maxBars) - 2),
          height: Math.max(2, height),
          background: isVerified ? "#4ECDC4" : "#ddd",
          borderRadius: 2,
          transition: "all 0.3s ease",
          opacity: isVerified ? 1 : 0.5,
        }}
      />
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ color: "#999", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Marginal return per facet
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 64 }}>
        {bars}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color: "#bbb", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>1</span>
        <span style={{ color: "#bbb", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{maxBars}</span>
      </div>
    </div>
  );
}

const PRESETS = [
  {
    name: "Bond Trading (from paper)",
    variables: [
      { name: "Date", facets: [false, false, false] },
      { name: "Oil Price", facets: [false, false, false] },
      { name: "Location", facets: [false, false, false] },
      { name: "Trade ID", facets: [false, false, false] },
      { name: "Counterparty", facets: [false, false, false] },
    ],
  },
  {
    name: "Simple API (2 vars)",
    variables: [
      { name: "user_id", facets: [true, true, false] },
      { name: "timestamp", facets: [false, false, false] },
    ],
  },
  {
    name: "Paper Table: m=5, r=3",
    variables: [
      { name: "var_1", facets: [true, false, false] },
      { name: "var_2", facets: [true, false, false] },
      { name: "var_3", facets: [true, false, false] },
      { name: "var_4", facets: [false, false, false] },
      { name: "var_5", facets: [false, false, false] },
    ],
  },
];

let nextId = 100;

function DarkFractionCalculator({ showFilePanel = true, onStateChange, externalVariables }) {
  const [csvStore] = useState(() => {
    const store = new CsvStore();
    DEFAULT_CSVS.forEach((c) => store.add(c));
    return store;
  });
  const [storeTick, setStoreTick] = useState(0);
  const refreshStore = useCallback(() => setStoreTick((t) => t + 1), []);
  const csvList = useMemo(() => csvStore.getAll(), [csvStore, storeTick]);

  const [variables, setVariables] = useState(() => {
    if (!showFilePanel) return [];
    return csvStore
      .getAll()
      .filter((c) => c.is_selected)
      .flatMap((c) =>
        c.column_names.map((name) => ({
          id: nextId++,
          name,
          facets: [false, false, false],
          facetValues: ["", "", ""],
          csvId: c.id,
        }))
      );
  });

  const m = variables.length;
  const r = variables.reduce((sum, v) => sum + v.facetValues.filter((val) => val.trim() !== "").length, 0);
  const result = useMemo(() => computeDarkFraction(m, r), [m, r]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) onStateChange({ m, r, variables, delta: result.delta, phi: result.phi });
  }, [m, r, result.delta]);

  // Accept external variables from event bus
  useEffect(() => {
    if (externalVariables && Array.isArray(externalVariables)) {
      setVariables(externalVariables.map((v, i) => ({
        id: nextId++,
        name: v.name || `var_${i + 1}`,
        facets: v.facets || [false, false, false],
        facetValues: v.facetValues || ["", "", ""],
      })));
    }
  }, [externalVariables]);

  const addVariable = useCallback(() => {
    setVariables((prev) => [
      ...prev,
      { id: nextId++, name: `variable_${prev.length + 1}`, facets: [false, false, false], facetValues: ["", "", ""] },
    ]);
  }, []);

  const removeVariable = useCallback((id) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
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

  const toggleFacet = useCallback((id, facetIndex) => {
    setVariables((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, facets: v.facets.map((f, i) => (i === facetIndex ? !f : f)) }
          : v
      )
    );
  }, []);

  const renameVariable = useCallback((id, name) => {
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
  }, []);

  const loadPreset = useCallback((preset) => {
    setVariables(
      preset.variables.map((v, i) => ({ ...v, id: nextId++, facetValues: v.facetValues || ["", "", ""] }))
    );
  }, []);

  const verifyAll = useCallback(() => {
    setVariables((prev) => prev.map((v) => ({ ...v, facets: [true, true, true] })));
  }, []);

  const clearAll = useCallback(() => {
    setVariables((prev) => prev.map((v) => ({ ...v, facets: [false, false, false] })));
  }, []);

  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".csv"));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const headers = parseCsvHeader(ev.target.result);
        if (headers.length === 0) return;
        const csvId = csvStore.add({
          filename: file.name,
          column_names: headers,
          is_selected: true,
        });
        refreshStore();
        setVariables((prev) => [
          ...prev,
          ...headers.map((name) => ({ id: nextId++, name, facets: [false, false, false], facetValues: ["", "", ""], csvId })),
        ]);
      };
      reader.readAsText(file);
    });
  }, [csvStore, refreshStore]);

  const removeCsvFile = useCallback((csvId) => {
    csvStore.remove(csvId);
    refreshStore();
    setVariables((prev) => prev.filter((v) => v.csvId !== csvId));
  }, [csvStore, refreshStore]);

  const toggleCsvSelected = useCallback((csvId) => {
    const csv = csvStore.get(csvId);
    if (!csv) return;
    const next = !csv.is_selected;
    csvStore.setSelected(csvId, next);
    refreshStore();
    if (next) {
      setVariables((prev) => [
        ...prev,
        ...csv.column_names.map((name) => ({
          id: nextId++,
          name,
          facets: [false, false, false],
          facetValues: ["", "", ""],
          csvId,
        })),
      ]);
    } else {
      setVariables((prev) => prev.filter((v) => v.csvId !== csvId));
    }
  }, [csvStore, refreshStore]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700;800&display=swap" rel="stylesheet" />

      {/* Drag overlay */}
      {dragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(78, 205, 196, 0.08)",
            border: "3px dashed #4ECDC4",
            borderRadius: 16,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{
            background: "#fff",
            padding: "20px 32px",
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#4ECDC4", marginBottom: 4 }}>
              Drop CSV file
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>
              Column headers become boundary variables
            </div>
          </div>
        </div>
      )}

      {/* FAR-LEFT COLUMN — file drop zone (conditional) */}
      {showFilePanel && (
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "52px 20px 32px",
          overflowY: "auto",
          borderRight: "1px solid #e0e0e0",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "2px dashed #d0d0d0",
            borderRadius: 16,
            padding: "32px 20px",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>⤓</div>
          <div style={{ color: "#555", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Drag &amp; drop files here
          </div>
          <div style={{ color: "#999", fontSize: 11, lineHeight: 1.5 }}>
            CSV column headers become boundary variables
          </div>
        </div>

        {csvList.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Files ({csvList.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {csvList.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: f.is_selected ? "#f9f9f9" : "#fafafa",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    opacity: f.is_selected ? 1 : 0.6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={f.is_selected}
                    onChange={() => toggleCsvSelected(f.id)}
                    title={f.is_selected ? "Uncheck to exclude" : "Check to include"}
                    style={{
                      width: 14,
                      height: 14,
                      cursor: "pointer",
                      accentColor: "#4ECDC4",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    title={`${f.filename} (${f.column_names.length} columns)`}
                    style={{
                      flex: 1,
                      color: "#555",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {f.filename}
                  </span>
                  {!f.is_default && (
                    <button
                      onClick={() => removeCsvFile(f.id)}
                      title="Remove file"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: "1px solid #e0e0e0",
                        background: "#fff",
                        color: "#bbb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontFamily: "system-ui",
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* MIDDLE COLUMN — visualization & stats */}
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
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: "24px 24px 16px", marginBottom: 16 }}>
            <DarkFractionGauge delta={result.delta} phi={result.phi} />

            {/* Legend */}
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
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <StatCard label="Variables (m)" value={m} color="#222" />
              <StatCard label="Facets (n=3m)" value={result.n} color="#222" />
              <StatCard label="Verified (r)" value={r} color="#3bb8ad" />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatCard label="|Ω| configs" value={formatLargeNumber(result.logOmega)} color="#888" sub="2^n" />
              <StatCard label="|Bᵣ| verified" value={formatLargeNumber(result.logBr)} color="#3bb8ad" sub="Hamming ball" />
            </div>

            {/* Marginal Returns */}
            {m > 0 && <MarginalReturnBar m={m} r={r} />}
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
                ⚠ Dark uncertainty dominates
              </div>
              <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>
                With {m} variables and {r} verified facets, {formatDelta(result.delta)} of the
                configuration space is unreachable by any within-boundary diagnostic. The system
                is operating somewhere in a space of {formatLargeNumber(result.logOmega)} configurations
                but can only confirm {formatLargeNumber(result.logBr)} of them.
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
                ✓ Collapsed uncertainty
              </div>
              <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>
                All facets verified. The boundary occupies a single known point in the
                configuration space.
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

      {/* RIGHT COLUMN — presets & boundary variables */}
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
        {/* Presets card */}
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Presets
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => loadPreset(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #e0e0e0",
                  background: "#f9f9f9",
                  color: "#666",
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Variables card */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              Boundary variables
            </div>
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
          </div>
          <div style={{ color: "#bbb", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
            drop a .csv to import
          </div>

          {/* Facet legend row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 6, paddingRight: 38 }}>
            {FACET_NAMES.map((name, i) => (
              <div
                key={name}
                style={{
                  width: 40,
                  textAlign: "center",
                  fontSize: 9,
                  color: FACET_COLORS[i],
                  opacity: 0.7,
                  letterSpacing: 0.5,
                }}
              >
                {name.slice(0, 3).toUpperCase()}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {variables.map((v, i) => (
              <VariableRow
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

          <button
            onClick={addVariable}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: 8,
              borderRadius: 10,
              border: "1px dashed #ccc",
              background: "#f9f9f9",
              color: "#999",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            + Add variable
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Export namespace ---
window.DFC = {
  parseCsvHeader, CsvObject, CsvStore, DEFAULT_CSVS,
  logBinom, logHammingBall, computeDarkFraction, formatLargeNumber, formatDelta,
  FACET_LABELS, FACET_NAMES, FACET_COLORS,
  FacetToggle, FacetInputRow, VariableRow, DarkFractionGauge, StatCard, MarginalReturnBar,
  PRESETS, DarkFractionCalculator,
};

})();
