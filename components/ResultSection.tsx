type ResultSectionProps = {
  title: string;
  items: string[];
};

export function ResultSection({ title, items }: ResultSectionProps) {
  return (
    <section className="result-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
