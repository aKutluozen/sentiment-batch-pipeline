type DatasetFilterCardProps = {
  datasetFilter: string;
  setDatasetFilter: (value: string) => void;
  datasetOptions: string[];
};

export default function DatasetFilterCard({
  datasetFilter,
  setDatasetFilter,
  datasetOptions,
}: DatasetFilterCardProps) {
  return (
    <section className="card">
      <div className="row">
        <h2>Analyze by Dataset</h2>
        <span>{datasetFilter === "all" ? "All datasets" : datasetFilter}</span>
        <select value={datasetFilter} onChange={(e) => setDatasetFilter(e.target.value)}>
          {datasetOptions.map((dataset) => (
            <option key={dataset} value={dataset}>
              {dataset === "all" ? "All datasets" : dataset}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
