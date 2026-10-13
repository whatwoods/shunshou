import { categoryOf, toolById, type Tool } from '../tools';
import { Link } from '../router';
import { mediaGuides } from './guides-media';
import { textGuides } from './guides-text';
import { toolTitle } from './metadata';

export const GUIDES = { ...mediaGuides, ...textGuides };

export default function ToolGuide({ tool }: { tool: Tool }) {
  const guide = GUIDES[tool.id];
  if (!guide || !tool.ready) return null;
  const related = guide.related.map(toolById).filter((t): t is Tool => !!t?.ready);
  return (
    <section className="tool-guide" aria-labelledby="guide-title">
      <h2 id="guide-title">{toolTitle(tool)}使用说明</h2>
      <p>{guide.summary}</p>
      <div className="guide-columns">
        <div>
          <h3>怎么用</h3>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3>使用前了解</h3>
          <ul>
            {guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
      <nav className="guide-links" aria-label="相关工具">
        {related.map((t) => (
          <Link key={t.id} to={t.path}>
            {toolTitle(t)}
          </Link>
        ))}
        <Link to={`/${tool.cat}`}>全部{categoryOf(tool.cat).name}工具</Link>
      </nav>
    </section>
  );
}
