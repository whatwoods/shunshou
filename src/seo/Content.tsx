import { Link } from '../router';
import { CATEGORIES, TOOLS } from '../tools';
import { site } from '../site';
import { CATEGORY_DESCRIPTIONS, categoryByPath, toolTitle } from './metadata';

export function SiteLinks() {
  return (
    <nav className="guide-links" aria-label="站点说明">
      <Link to="/about">关于顺手</Link>
      <Link to="/privacy">隐私说明</Link>
      <Link to="/licenses">开源许可</Link>
      {site.repoUrl && <a href={site.repoUrl}>源代码</a>}
    </nav>
  );
}

export function Directory({ category }: { category?: string }) {
  return (
    <div className="seo-directory">
      {CATEGORIES.filter((c) => !category || c.id === category).map((c) => (
        <section key={c.id}>
          <h2>
            <Link to={`/${c.id}`}>{c.name}工具</Link>
          </h2>
          <p>{CATEGORY_DESCRIPTIONS[c.id]}</p>
          <ul>
            {TOOLS.filter((t) => t.ready && t.cat === c.id).map((t) => (
              <li key={t.id}>
                <Link to={t.path}>{toolTitle(t)}</Link>
                <span>{t.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ContentBody({ path }: { path: string }) {
  const category = categoryByPath(path);
  if (category)
    return (
      <>
        <h1>{category.name}工具</h1>
        <p>{CATEGORY_DESCRIPTIONS[category.id]}所有内容在你的设备上处理。</p>
        <Directory category={category.id} />
        <SiteLinks />
      </>
    );
  if (path === '/privacy')
    return (
      <>
        <h1>隐私说明</h1>
        <p>顺手在浏览器里处理你选中的文件和输入的内容，不把这些内容上传到服务器。使用工具无需注册账号。</p>
        <h2>哪些信息留在设备上</h2>
        <p>
          最近使用、收藏、主题与工具设置保存在浏览器本机存储中。文件和输入正文不作为偏好设置保存；下载的结果由你自行保管。清除本站的网站数据可以删除偏好和离线缓存。
        </p>
        <h2>浏览器会请求什么</h2>
        <p>
          首次访问或打开新功能时，浏览器会从本站获取页面、程序、字体和处理所需资源。静态托管服务仍会接收到这些资源请求及连接信息，这与上传你处理的文件和正文不同。
        </p>
        <h2>统计与外部服务</h2>
        <p>
          顺手没有统计、埋点或第三方追踪脚本，处理依赖由本站提供。网页的内容安全策略限制对外连接。主动打开源代码或反馈链接后，会进入
          GitHub，其服务规则由 GitHub 提供。
        </p>
        <h2>HTML 预览</h2>
        <p>HTML 预览在隔离页面中运行，限制网络访问与跳转。即使打开“运行脚本”，这些隔离限制仍然有效。</p>
        <h2>如何核对</h2>
        <p>
          {site.repoUrl ? <a href={site.repoUrl}>查看顺手源代码</a> : '部署者可检查项目源码'}，或用浏览器的网络面板检查工具运行时的请求。
        </p>
        <SiteLinks />
      </>
    );
  return (
    <>
      <h1>关于顺手</h1>
      <p>
        顺手是一个浏览器里的实用工具箱，提供 {TOOLS.filter((t) => t.ready).length}{' '}
        个工具，覆盖办公文本、PDF、图像、音视频、开发编码和数据处理。无需账号，打开页面就能使用。
      </p>
      <h2>怎样找到合适的工具</h2>
      <p>从首页打开一个文件，顺手会按文件类型推荐工具。也可以按分类浏览，或搜索工具名称和用途。处理后的结果可通过“接着用”交给其他工具。</p>
      <h2>文件会上传吗</h2>
      <p>
        文件和输入内容在你的设备上处理。最近使用、收藏和设置保存在本机。具体范围见<Link to="/privacy">隐私说明</Link>。
      </p>
      <h2>断网时能用吗</h2>
      <p>
        首页和已经缓存的工具资源可在离线时使用。首次使用某个工具、格式或处理模型时，仍需联网加载相应资源；没有加载完整的功能不能保证离线可用。
      </p>
      <h2>支持哪些设备和文件</h2>
      <p>
        可在桌面和手机的现代浏览器使用，需要启用
        JavaScript。每个工具的输入格式与限制见对应页面；音视频编解码能力、大文件处理速度和可用内存取决于浏览器与设备。
      </p>
      <h2>源代码与反馈</h2>
      <p>
        {site.repoUrl ? (
          <>
            <a href={site.repoUrl}>查看源代码和自行部署说明</a>，或在 <a href={`${site.repoUrl}/issues`}>GitHub 提交问题</a>。
          </>
        ) : (
          '请向本站部署者反馈问题。'
        )}
        第三方组件的许可与来源见<Link to="/licenses">开源许可</Link>。
      </p>
      <nav className="guide-links" aria-label="工具分类">
        {CATEGORIES.map((c) => (
          <Link key={c.id} to={`/${c.id}`}>
            {c.name}
          </Link>
        ))}
      </nav>
      <SiteLinks />
    </>
  );
}
