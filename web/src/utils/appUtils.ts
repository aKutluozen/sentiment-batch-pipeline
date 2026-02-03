export const buildSummaryPath = (outputCsv: string) => {
  if (!outputCsv) {
    return "";
  }
  const dotIndex = outputCsv.lastIndexOf(".");
  if (dotIndex === -1) {
    return `${outputCsv}_group_summary.json`;
  }
  return `${outputCsv.slice(0, dotIndex)}_group_summary.json`;
};

export const formatShortTimestamp = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mo = String(parsed.getMonth() + 1).padStart(2, "0");
  const yy = String(parsed.getFullYear()).slice(-2);
  return `${mo}/${dd}/${yy}-${hh}/${mm}`;
};

export const sentimentClass = (labelValue: string) => {
  const value = labelValue.toLowerCase();
  if (value.includes("pos")) {
    return "text-positive";
  }
  if (value.includes("neg")) {
    return "text-negative";
  }
  return "text-average";
};
