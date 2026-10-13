import { Nav } from '../components/Nav';
import { Link } from '../router';
import { ContentBody } from '../seo/Content';

export default function ContentPage({ path }: { path: string }) {
  return (
    <div className="tool-page">
      <Nav />
      <main className="tool-main seo-page">
        <p className="crumb">
          <Link to="/" back>
            返回工具箱
          </Link>
        </p>
        <ContentBody path={path} />
      </main>
      <footer className="tool-foot">顺手 · 把小事做顺手</footer>
    </div>
  );
}
