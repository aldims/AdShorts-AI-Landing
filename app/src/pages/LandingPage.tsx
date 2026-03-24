import { Link } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";

type Session = {
  name: string;
  email: string;
  plan: string;
} | null;

type Props = {
  session: Session;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspace: () => void;
};

const studioModes = ["Script", "Voice", "Visual", "Captions"];
const studioLayers = [
  { label: "AI Script", value: "Hook / pacing / CTA" },
  { label: "Voice", value: "Natural RU narration" },
  { label: "Captions", value: "Auto-highlight timing" },
];
const waveformBars = [14, 22, 30, 18, 12, 26, 34, 17, 28, 20, 32, 16];
const editorModes = ["Narration", "Scenes", "Captions"];
const editorFormats = ["Tune", "0:32", "9000", "9:16"];

export function LandingPage({ session, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const topic = "AI tools";
  const status = "Ready to generate";

  const openPrimaryFlow = () => {
    if (session) {
      onOpenWorkspace();
      return;
    }

    onOpenSignup();
  };

  return (
    <div className="route-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="home" onOpenStudio={openPrimaryFlow} />

          <div className="site-header__actions">
            <Link className="site-header__link" to="/pricing">
              Pricing
            </Link>
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            {session ? (
              <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={session.plan} />
            ) : (
              <button className="site-header__link route-button" type="button" onClick={onOpenSignin}>
                Sign in
              </button>
            )}
            {!session ? (
              <button className="btn btn--header route-button" type="button" onClick={openPrimaryFlow}>
                Создать видео бесплатно
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero__scene" aria-hidden="true">
            <span className="hero__scene-stars"></span>
            <span className="hero__scene-glow hero__scene-glow--left"></span>
            <span className="hero__scene-glow hero__scene-glow--center"></span>
            <span className="hero__scene-glow hero__scene-glow--right"></span>
            <span className="hero__scene-orbit hero__scene-orbit--one"></span>
            <span className="hero__scene-orbit hero__scene-orbit--two"></span>
            <span className="hero__scene-beam"></span>
          </div>

          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">AI studio for short-form creators</p>
              <h1>
                <span className="hero__title-highlight">Shorts / Reels / TikTok</span>
                <span className="hero__title-subline">за 1 минуту. В один клик.</span>
              </h1>
              <p className="hero__lead">
                Превратите любую вашу идею в готовый Shorts.
              </p>

              <div className="hero__actions">
                <button className="btn btn--primary btn--hero route-button" type="button" onClick={openPrimaryFlow}>
                  Создать Shorts бесплатно
                </button>
              </div>

              <ul className="hero__features">
                <li>Оптимизирован под Shorts</li>
                <li>Всё делается автоматически</li>
                <li>Готово к публикации</li>
              </ul>

              <div className="hero__service-pills" aria-label="Что входит в ролик">
                <span className="hero__service-pill">AI сценарий</span>
                <span className="hero__service-pill">Озвучка</span>
                <span className="hero__service-pill">Визуал</span>
                <span className="hero__service-pill">Субтитры</span>
                <span className="hero__service-pill">Музыка</span>
                <span className="hero__service-pill">9:16</span>
              </div>
            </div>

            <aside className="hero-studio-card" aria-label="Studio preview card">
              <div className="hero-studio-card__shell">
                <div className="hero-studio-card__topbar">
                  <div className="hero-studio-card__brand">
                    <span className="hero-studio-card__brand-mark"></span>
                    <span>AdShorts Studio</span>
                  </div>
                  <div className="hero-studio-card__topmeta">
                    <span>Web beta</span>
                    <span>{status}</span>
                  </div>
                </div>

                <div className="hero-studio-card__workspace">
                  <div className="hero-studio-card__sidebar">
                    {studioModes.map((item, index) => (
                      <span className={index === 0 ? "is-active" : ""} key={item}>
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="hero-studio-card__preview">
                    <div className="hero-studio-card__canvas">
                      <div className="hero-studio-card__nebula"></div>
                      <div className="hero-studio-card__ring"></div>
                      <div className="hero-studio-card__caption">
                        <span className="hero-studio-card__caption-label">Preview script</span>
                        <strong>{topic}</strong>
                        <p>Один prompt превращается в hook, визуал и voiceover для вертикального ролика.</p>
                      </div>
                    </div>

                    <div className="hero-studio-card__layers">
                      {studioLayers.map((item) => (
                        <article key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </article>
                      ))}
                    </div>

                    <div className="hero-studio-card__timeline">
                      <div className="hero-studio-card__timeline-head">
                        <span>Timeline</span>
                        <span>0:58</span>
                      </div>
                      <div className="hero-studio-card__waveform" aria-hidden="true">
                        {waveformBars.map((height, index) => (
                          <span key={`${height}-${index}`} style={{ height }}></span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="hero-editor-card" aria-label="Studio timeline preview">
              <div className="hero-editor-card__rail">
                <div className="hero-editor-card__brand">
                  <span className="hero-editor-card__brand-mark"></span>
                  <span>AdShorts.AI</span>
                </div>
                <div className="hero-editor-card__nav">
                  <span className="is-active">AI script</span>
                  <span>Timeline</span>
                  <span>Preview</span>
                </div>
              </div>

              <div className="hero-editor-card__main">
                <div className="hero-editor-card__head">
                  <span>Batch editor</span>
                  <span>0:58</span>
                </div>

                <div className="hero-editor-card__script">
                  <p>
                    {topic} превращается в готовый vertical-first сценарий: сильный hook, 3 сцены, AI voiceover и
                    финальный CTA без ручного монтажа.
                  </p>
                </div>

                <div className="hero-editor-card__wave-row">
                  <div className="hero-editor-card__waveform" aria-hidden="true">
                    {waveformBars.map((height, index) => (
                      <span key={`editor-${height}-${index}`} style={{ height: Math.max(10, height - 2) }}></span>
                    ))}
                  </div>

                  <div className="hero-editor-card__thumb" aria-hidden="true">
                    <div className="hero-editor-card__thumb-ring"></div>
                  </div>
                </div>

                <div className="hero-editor-card__footer">
                  <div className="hero-editor-card__chips">
                    {editorModes.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                    {editorFormats.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>

                  <button className="btn hero-editor-card__cta route-button" type="button" onClick={openPrimaryFlow}>
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="container hero__trust">
            <span className="hero__trust-label">Built for</span>
            <div className="hero__trust-list">
              <span>YouTube Shorts</span>
              <span>Instagram Reels</span>
              <span>TikTok</span>
              <span>Solo creators</span>
              <span>Brand teams</span>
              <span>Growth agencies</span>
            </div>
          </div>
        </section>

        <section className="section section--paper section--tight" id="product">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">One flagship product</p>
              <h2>Один продукт для всего пайплайна коротких видео.</h2>
              <p>
                AdShorts AI не должен выглядеть как бот-надстройка или набор разрозненных утилит. Главная страница
                продает цельный продукт, а ниже раскрывает его core capabilities.
              </p>
            </div>

            <div className="capability-grid">
              <article className="capability capability--lead">
                <span className="capability__label">AdShorts AI Core</span>
                <h3>От идеи до ready-to-post ролика в одном editorial flow.</h3>
                <p>
                  Brief, hook, voice, visual language, captions и export собираются в одном продукте, который ощущается
                  как настоящий web studio, а не как цепочка из пяти разрозненных шагов.
                </p>

                <div className="capability__list">
                  <span>Hook &amp; structure</span>
                  <span>Voice direction</span>
                  <span>Visual treatment</span>
                  <span>Captions &amp; pacing</span>
                  <span>Batch generation</span>
                  <span>9:16 delivery</span>
                </div>
              </article>

              <article className="capability">
                <span className="capability__label">AI Script</span>
                <h3>Структура для первого экрана и удержания.</h3>
                <p>Сильный hook, ритм и сценарная логика под vertical-first format.</p>
              </article>

              <article className="capability">
                <span className="capability__label">Voiceover</span>
                <h3>Озвучка, которая ощущается частью продукта.</h3>
                <p>Natural delivery, multilanguage voice options и быстрая правка тона.</p>
              </article>

              <article className="capability">
                <span className="capability__label">Visuals</span>
                <h3>Визуалы и динамика, а не просто stock-замена.</h3>
                <p>Готовые сцены, motion rhythm и consistent visual treatment для серий.</p>
              </article>

              <article className="capability">
                <span className="capability__label">Captions</span>
                <h3>Субтитры и акценты, которые читаются без звука.</h3>
                <p>Ключевые фразы, semantic emphasis и скорость чтения под мобайл.</p>
              </article>

              <article className="capability">
                <span className="capability__label">Export</span>
                <h3>Готово для Shorts, Reels и TikTok без ручной адаптации.</h3>
                <p>Native 9:16 export, batch preview и быстрый handoff в публикацию.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--stone" id="studio">
          <div className="container">
            <div className="section-head section-head--split">
              <div>
                <p className="eyebrow eyebrow--dark">Live web studio</p>
                <h2>Пробуйте тему прямо на странице.</h2>
                <p>
                  Ниже — локальный high-fidelity модуль, который показывает, как должен ощущаться основной web-продукт.
                  Здесь важен UX-flow, а не реальная backend-генерация.
                </p>
              </div>

              <div className="section-head__aside">
                <span className="section-chip">Web-first UX</span>
                <span className="section-chip">Local mock state</span>
                <span className="section-chip">Local auth flow</span>
              </div>
            </div>

          </div>
        </section>

        <section className="section section--paper" id="examples">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">Editorial product story</p>
              <h2>Сайт должен продавать не экран управления, а результат.</h2>
              <p>
                Поэтому ниже — большие медиаблоки, сценарии использования и outcomes, которые объясняют продукт через
                итоговый эффект, а не через интерфейсную механику.
              </p>
            </div>

            <div className="showcase-grid">
              <article className="showcase-card showcase-card--wide">
                <div className="showcase-card__media">
                  <div className="showcase-frame">
                    <span className="showcase-frame__label">Campaign system</span>
                    <strong>One topic. Multiple hooks. One export flow.</strong>
                    <div className="showcase-frame__rails">
                      <span>Hook variations</span>
                      <span>Voice versions</span>
                      <span>Visual styles</span>
                      <span>Captions</span>
                    </div>
                  </div>
                </div>

                <div className="showcase-card__copy">
                  <span className="showcase-card__label">Why it matters</span>
                  <h3>AdShorts AI должен ощущаться как основная production-система для short-form.</h3>
                  <p>
                    Не просто генератор идеи, а место, где собирается полный пакет роликов для теста оффера, гипотезы
                    или серии контента.
                  </p>
                  <div className="showcase-metrics">
                    <article>
                      <strong>1 brief</strong>
                      <span>на входе</span>
                    </article>
                    <article>
                      <strong>3-5 cuts</strong>
                      <span>на выходе</span>
                    </article>
                    <article>
                      <strong>0 handoff</strong>
                      <span>между инструментами</span>
                    </article>
                  </div>
                </div>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Creators</span>
                <h3>Тестируйте серию идей, не собирая каждый ролик вручную.</h3>
                <p>
                  Один продукт для поиска hook, темпа, визуального treatment и быстрой публикации в short-form каналы.
                </p>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Teams</span>
                <h3>Давайте growth-команде не “сырой AI”, а production-ready output.</h3>
                <p>Web-first flow помогает продавать продукт через результат, а не через список технических функций.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--workflow">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">How it works</p>
              <h2>От темы до готового batch-а за 3 шага.</h2>
            </div>

            <div className="steps-grid">
              <article className="step-card">
                <div className="step-card__num">01</div>
                <h3>Введите тему</h3>
                <p>Идея, ниша, оффер или тренд, который нужно превратить в short-form batch.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">02</div>
                <h3>Соберите пакет роликов</h3>
                <p>Сценарий, озвучка, визуал, subtitles и pacing собираются в одном flow.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">03</div>
                <h3>Скачайте и публикуйте</h3>
                <p>Готово для Shorts, Reels и TikTok без ручной адаптации и лишнего handoff.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--stone" id="history">
          <div className="container trust-shell">
            <div className="trust-shell__copy">
              <p className="eyebrow eyebrow--dark">Trust &amp; speed</p>
              <h2>Сильный продукт должен считываться за 20 секунд.</h2>
              <p>
                Поэтому новый landing-first подход сначала продает outcome, затем показывает capabilities, и только
                после этого раскрывает local studio module.
              </p>
            </div>

            <div className="trust-stats">
              <article className="stat-card">
                <strong>50,000+</strong>
                <span>creators &amp; marketers</span>
              </article>
              <article className="stat-card">
                <strong>12M+</strong>
                <span>shorts generated</span>
              </article>
              <article className="stat-card">
                <strong>4.9/5</strong>
                <span>ощущение сильного AI-продукта</span>
              </article>
              <article className="stat-card">
                <strong>3 min</strong>
                <span>до первого preview batch</span>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="pricing">
          <div className="container pricing-shell">
            <div className="pricing-shell__copy">
              <p className="eyebrow">Find your launch flow</p>
              <h2>Веб-студия сверху. Бот и guides — ниже по иерархии.</h2>
              <p>
                Главная должна продавать AdShorts AI как web-продукт с сильным editorial presentation, а не как
                промо-страницу для Telegram.
              </p>

              <div className="pricing-shell__actions">
                <button className="btn btn--primary route-button" type="button" onClick={openPrimaryFlow}>
                  Создать Shorts бесплатно
                </button>
              </div>
              <a
                className="pricing-shell__micro-link"
                href="https://t.me/AdShortsAIBot"
                target="_blank"
                rel="noopener noreferrer"
              >
                Предпочитаете Telegram? Открыть бота
              </a>
            </div>

            <div className="plan-grid">
              <article className="plan-card">
                <span className="plan-card__label">Creator</span>
                <h3>Быстрый тест идеи</h3>
                <p>Для solo creators, founders и маркетологов, которым нужен быстрый batch под Shorts.</p>
                <ul className="plan-card__list">
                  <li>Script + voice + visuals</li>
                  <li>Batch preview</li>
                  <li>9:16 export</li>
                </ul>
              </article>

              <article className="plan-card plan-card--accent">
                <span className="plan-card__label">Growth</span>
                <h3>Система для контент-команды</h3>
                <p>Для агентств и growth-команд, которым нужен единый short-form workflow вместо ручной сборки.</p>
                <ul className="plan-card__list">
                  <li>Reusable styles</li>
                  <li>Voice direction</li>
                  <li>Series-ready pipeline</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--guides" id="guides">
          <div className="container guides-strip">
            <div className="guides-strip__copy">
              <p className="eyebrow eyebrow--dark">Guides / SEO layer</p>
              <h2>Гайды остаются слоем дистрибуции, но не спорят с продуктовой историей.</h2>
            </div>

            <div className="guides-strip__cards">
              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/shorts-guides/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">Hub</span>
                <h3>Shorts Guides</h3>
                <p>Единая точка входа в материалы по стратегии, удержанию и росту.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/kak-sdelat-huk-v-shorts/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">Hook</span>
                <h3>Как сделать сильный первый экран</h3>
                <p>Что удерживает внимание и снижает вероятность свайпа.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/subtitry-dlya-shorts-avtomatom/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">Captions</span>
                <h3>Автоматические субтитры</h3>
                <p>Как captions помогают short-form контенту работать даже без звука.</p>
              </a>
            </div>

            <a
              className="guides-strip__cta route-linkbtn"
              href="http://127.0.0.1:4173/shorts-guides/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Все материалы
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <p>App staging route for AdShorts AI.</p>
            <p>© 2026 AdShorts AI</p>
          </div>

          <div className="footer__links">
            <a href="#studio">Web studio</a>
            <a href="#guides">Guides</a>
            <a href="https://t.me/AdShortsAIBot" target="_blank" rel="noopener noreferrer">
              Telegram bot
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
