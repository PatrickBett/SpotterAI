export default function LogSheet({ logs }) {
  return (
    <div>
      <h3>ELD Logs</h3>
      {logs.map((day) => (
        <div key={day.day}>
          <h4>Day {day.day}</h4>
          <div style={{ border: "1px solid black", padding: 10 }}>
            {day.segments.map((seg, i) => (
              <div key={i}>
                {seg.status}: {seg.start} → {seg.end}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
